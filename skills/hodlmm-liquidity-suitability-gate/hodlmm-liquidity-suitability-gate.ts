#!/usr/bin/env bun
/**
 * HODLMM Liquidity Suitability Gate
 *
 * Read-only admission primitive for deciding whether a HODLMM/DLMM pool is
 * safe enough to hold, watch, block, or add more capital to for a specific
 * wallet and risk profile.
 */

import { Command } from "commander";

const BITFLOW_APP_API = "https://bff.bitflowapis.finance/api/app/v1";
const HIRO_API = "https://api.hiro.so";
const FETCH_TIMEOUT_MS = 30000;

const PROFILE_PRESETS = {
  low: {
    maxPoolAllocationPct: 15,
    maxSinglePoolConcentrationPct: 20,
    maxSlippageBps: 80,
    minLiquidityUsd: 250000,
    minVolume24hUsd: 50000,
    maxImbalanceRatio: 4,
  },
  balanced: {
    maxPoolAllocationPct: 30,
    maxSinglePoolConcentrationPct: 35,
    maxSlippageBps: 150,
    minLiquidityUsd: 100000,
    minVolume24hUsd: 25000,
    maxImbalanceRatio: 8,
  },
  high: {
    maxPoolAllocationPct: 50,
    maxSinglePoolConcentrationPct: 60,
    maxSlippageBps: 300,
    minLiquidityUsd: 50000,
    minVolume24hUsd: 10000,
    maxImbalanceRatio: 15,
  },
} as const;

type RiskProfile = keyof typeof PROFILE_PRESETS;
type Decision = "block" | "watch" | "allow_hold" | "allow_add";

interface PoolToken {
  symbol?: string;
  reserve?: number;
  reserveUsd?: number;
  priceUsd?: number;
}

interface PoolRecord {
  poolId?: string;
  category?: string;
  type?: string;
  types?: string[];
  tvlUsd?: number;
  liquidityUsd?: number;
  volumeUsd1d?: number;
  volumeUsd7d?: number;
  feesUsd1d?: number;
  feesUsd7d?: number;
  apr?: number;
  apr24h?: number;
  poolVerified?: boolean;
  suggested?: boolean;
  sbtcIncentives?: boolean;
  poolComposition?: {
    tokenX?: { percentage?: number; liquidityUsd?: number };
    tokenY?: { percentage?: number; liquidityUsd?: number };
  };
  tokens?: {
    tokenX?: PoolToken;
    tokenY?: PoolToken;
  };
}

function out(obj: unknown): void {
  console.log(JSON.stringify(obj, null, 2));
}

function fail(code: string, message: string, next: string, status = 1): never {
  out({
    status: "blocked",
    action: "Do not use this pool decision until the blocker is resolved",
    data: {},
    error: { code, message, next },
  });
  process.exit(status);
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}: ${url}`);
  return res.json() as Promise<T>;
}

async function getPools(): Promise<PoolRecord[]> {
  const response = await fetchJson<{ data?: PoolRecord[] }>(`${BITFLOW_APP_API}/pools`);
  return Array.isArray(response.data) ? response.data : [];
}

async function getPool(poolId: string): Promise<PoolRecord> {
  return fetchJson<PoolRecord>(`${BITFLOW_APP_API}/pools/${poolId}`);
}

async function getStxBalance(address: string): Promise<number> {
  const data = await fetchJson<{ balance: string; locked: string }>(`${HIRO_API}/extended/v1/address/${address}/stx`);
  return Math.max(0, Number(data.balance || "0") - Number(data.locked || "0"));
}

function profileThresholds(profile: RiskProfile, overrides: {
  maxPoolAllocationPct?: number;
  maxSinglePoolConcentrationPct?: number;
  maxSlippageBps?: number;
}): {
  maxPoolAllocationPct: number;
  maxSinglePoolConcentrationPct: number;
  maxSlippageBps: number;
  minLiquidityUsd: number;
  minVolume24hUsd: number;
  maxImbalanceRatio: number;
} {
  const base = PROFILE_PRESETS[profile];
  return {
    ...base,
    maxPoolAllocationPct: overrides.maxPoolAllocationPct ?? base.maxPoolAllocationPct,
    maxSinglePoolConcentrationPct:
      overrides.maxSinglePoolConcentrationPct ?? base.maxSinglePoolConcentrationPct,
    maxSlippageBps: overrides.maxSlippageBps ?? base.maxSlippageBps,
  };
}

function reserveUsd(token?: PoolToken): number {
  if (!token) return 0;
  if (typeof token.reserveUsd === "number") return token.reserveUsd;
  const reserve = typeof token.reserve === "number" ? token.reserve : 0;
  const priceUsd = typeof token.priceUsd === "number" ? token.priceUsd : 0;
  return reserve * priceUsd;
}

function estimateSlippageBps(pool: PoolRecord, sizeUsd: number): number {
  const liquidityUsd = Number(pool.liquidityUsd ?? pool.tvlUsd ?? 0);
  if (liquidityUsd <= 0) return 99999;
  return Math.round((sizeUsd / liquidityUsd) * 10000);
}

function imbalanceRatio(pool: PoolRecord): number {
  const pctX = Number(pool.poolComposition?.tokenX?.percentage ?? 0);
  const pctY = Number(pool.poolComposition?.tokenY?.percentage ?? 0);
  if (pctX > 0 && pctY > 0) {
    const minSide = Math.min(pctX, pctY);
    const maxSide = Math.max(pctX, pctY);
    return Number((maxSide / minSide).toFixed(4));
  }

  const x = reserveUsd(pool.tokens?.tokenX);
  const y = reserveUsd(pool.tokens?.tokenY);
  const minSide = Math.min(x, y);
  const maxSide = Math.max(x, y);
  if (minSide <= 0) return 99999;
  return Number((maxSide / minSide).toFixed(4));
}

function recentActivityRatio(pool: PoolRecord): number {
  const volume1d = Number(pool.volumeUsd1d ?? 0);
  const volume7d = Number(pool.volumeUsd7d ?? 0);
  const avgDaily = volume7d > 0 ? volume7d / 7 : 0;
  if (avgDaily <= 0) return 0;
  return Number((volume1d / avgDaily).toFixed(4));
}

function poolLabel(pool: PoolRecord): string {
  if (Array.isArray(pool.types) && pool.types.length > 0) return pool.types.join(",");
  return String(pool.category || pool.type || "UNKNOWN");
}

function decide(input: {
  deployableBalanceUsd: number;
  currentPoolAllocationUsd: number;
  addAmountUsd: number;
  slippageBps: number;
  liquidityUsd: number;
  volume24hUsd: number;
  imbalance: number;
  recentActivityRatio: number;
  apr24hPct: number;
  poolVerified: boolean;
  sbtcIncentives: boolean;
  thresholds: ReturnType<typeof profileThresholds>;
}): { decision: Decision; reasons: string[]; suitability: string } {
  const reasons: string[] = [];
  const totalIfAdded = input.currentPoolAllocationUsd + input.addAmountUsd;
  const nextPoolAllocationPct = input.deployableBalanceUsd > 0
    ? (totalIfAdded / input.deployableBalanceUsd) * 100
    : 100;
  const currentPoolConcentrationPct = input.deployableBalanceUsd > 0
    ? (input.currentPoolAllocationUsd / input.deployableBalanceUsd) * 100
    : 100;

  if (input.liquidityUsd < input.thresholds.minLiquidityUsd) {
    reasons.push("pool_liquidity_below_profile_floor");
  }
  if (input.volume24hUsd < input.thresholds.minVolume24hUsd && input.recentActivityRatio < 0.4) {
    reasons.push("pool_volume_below_profile_floor");
  }
  if (input.imbalance > input.thresholds.maxImbalanceRatio) {
    reasons.push("pool_imbalance_above_profile_limit");
  }
  if (input.slippageBps > input.thresholds.maxSlippageBps) {
    reasons.push("slippage_above_profile_limit");
  }
  if (currentPoolConcentrationPct > input.thresholds.maxSinglePoolConcentrationPct) {
    reasons.push("existing_pool_concentration_above_limit");
  }
  if (nextPoolAllocationPct > input.thresholds.maxPoolAllocationPct) {
    reasons.push("post_add_allocation_above_limit");
  }

  const severe = reasons.filter((r) =>
    [
      "slippage_above_profile_limit",
      "pool_imbalance_above_profile_limit",
      "existing_pool_concentration_above_limit",
      "post_add_allocation_above_limit",
    ].includes(r)
  );

  if (severe.length >= 2) {
    return { decision: "block", reasons, suitability: "not_suitable" };
  }
  if (reasons.length >= 1) {
    if (reasons.includes("post_add_allocation_above_limit") || reasons.includes("slippage_above_profile_limit")) {
      return { decision: "allow_hold", reasons, suitability: "hold_only" };
    }
    return { decision: "watch", reasons, suitability: "caution" };
  }

  const positiveReasons: string[] = [];
  if (input.recentActivityRatio >= 0.8) positiveReasons.push("recent_activity_supports_deployment");
  if (input.apr24hPct > 0) positiveReasons.push("pool_is_generating_live_fee_yield");
  if (input.poolVerified) positiveReasons.push("pool_verified_by_bitflow");
  if (input.sbtcIncentives) positiveReasons.push("pool_has_sbtc_incentives");

  return {
    decision: input.addAmountUsd > 0 ? "allow_add" : "allow_hold",
    reasons: positiveReasons.length > 0
      ? positiveReasons
      : [input.addAmountUsd > 0 ? "pool_and_profile_support_additional_size" : "pool_within_profile_for_hold"],
    suitability: input.addAmountUsd > 0 ? "suitable_to_add" : "suitable_to_hold",
  };
}

async function doctor(address?: string) {
  try {
    const pools = await getPools();
    const sample = pools[0];
    const stxBalance = address ? await getStxBalance(address) : null;
    out({
      status: "success",
      action: "ready",
      data: {
        skill: "hodlmm-liquidity-suitability-gate",
        network: "mainnet",
        checks: {
          bitflowPoolsReachable: pools.length > 0,
          samplePoolId: sample?.poolId ?? null,
          sampleCategory: sample ? poolLabel(sample) : null,
          hiroReachable: address ? stxBalance !== null : true,
          walletProbe: address ? { address, stx_ustx: stxBalance } : null,
        },
      },
      error: null,
    });
  } catch (error) {
    fail(
      "doctor_failed",
      error instanceof Error ? error.message : String(error),
      "Verify Bitflow/Hiro reachability and retry"
    );
  }
}

async function evaluate(opts: {
  address?: string;
  poolId: string;
  riskProfile: RiskProfile;
  deployableBalanceUsd: number;
  currentPoolAllocationUsd: number;
  addAmountUsd: number;
  maxPoolAllocationPct?: number;
  maxSinglePoolConcentrationPct?: number;
  maxSlippageBps?: number;
}) {
  try {
    const pool = await getPool(opts.poolId);
    const thresholds = profileThresholds(opts.riskProfile, {
      maxPoolAllocationPct: opts.maxPoolAllocationPct,
      maxSinglePoolConcentrationPct: opts.maxSinglePoolConcentrationPct,
      maxSlippageBps: opts.maxSlippageBps,
    });

    const liquidityUsd = Number(pool.liquidityUsd ?? pool.tvlUsd ?? 0);
    const volume24hUsd = Number(pool.volumeUsd1d ?? 0);
    const fees24hUsd = Number(pool.feesUsd1d ?? 0);
    const apr24hPct = Number(pool.apr24h ?? pool.apr ?? 0);
    const slippageBps = estimateSlippageBps(pool, Math.max(opts.addAmountUsd, 1000));
    const imbalance = imbalanceRatio(pool);
    const activityRatio = recentActivityRatio(pool);
    const poolVerified = Boolean(pool.poolVerified);
    const sbtcIncentives = Boolean(pool.sbtcIncentives);

    const verdict = decide({
      deployableBalanceUsd: opts.deployableBalanceUsd,
      currentPoolAllocationUsd: opts.currentPoolAllocationUsd,
      addAmountUsd: opts.addAmountUsd,
      slippageBps,
      liquidityUsd,
      volume24hUsd,
      imbalance,
      recentActivityRatio: activityRatio,
      apr24hPct,
      poolVerified,
      sbtcIncentives,
      thresholds,
    });

    const totalIfAdded = opts.currentPoolAllocationUsd + opts.addAmountUsd;
    const nextPoolAllocationPct = opts.deployableBalanceUsd > 0
      ? Number(((totalIfAdded / opts.deployableBalanceUsd) * 100).toFixed(2))
      : 100;
    const currentPoolConcentrationPct = opts.deployableBalanceUsd > 0
      ? Number(((opts.currentPoolAllocationUsd / opts.deployableBalanceUsd) * 100).toFixed(2))
      : 100;

    out({
      status: verdict.decision === "block" ? "blocked" : "success",
      action:
        verdict.decision === "allow_add"
          ? "Pool is suitable for additional size under this risk profile"
          : verdict.decision === "allow_hold"
            ? "Pool is acceptable to hold, but not suitable for more size under this profile"
            : verdict.decision === "watch"
              ? "Pool needs caution before any new capital is added"
              : "Do not add capital to this pool under current conditions",
      data: {
        decision: verdict.decision,
        suitability: verdict.suitability,
        poolId: opts.poolId,
        category: poolLabel(pool),
        riskProfile: opts.riskProfile,
        wallet: opts.address ?? null,
        checks: {
          deployableBalanceUsd: opts.deployableBalanceUsd,
          currentPoolAllocationUsd: opts.currentPoolAllocationUsd,
          addAmountUsd: opts.addAmountUsd,
          nextPoolAllocationUsd: totalIfAdded,
          currentPoolConcentrationPct,
          nextPoolAllocationPct,
          liquidityUsd,
          volume24hUsd,
          fees24hUsd,
          apr24hPct,
          recentActivityRatio: activityRatio,
          slippageEstimateBps: slippageBps,
          imbalanceRatio: imbalance,
          poolVerified,
          sbtcIncentives,
        },
        thresholds,
        reasons: verdict.reasons,
      },
      error:
        verdict.decision === "block"
          ? {
              code: "pool_not_suitable_for_profile",
              message: "Pool conditions and allocation profile do not support adding more size",
              next: "Reduce size, change profile thresholds, or choose a stronger pool"
            }
          : null,
    });

    if (verdict.decision === "block") {
      process.exit(2);
    }
  } catch (error) {
    fail(
      "evaluation_failed",
      error instanceof Error ? error.message : String(error),
      "Verify pool id, numeric inputs, and upstream API availability"
    );
  }
}

const program = new Command();
program
  .name("hodlmm-liquidity-suitability-gate")
  .description("Read-only suitability gate for holding or adding HODLMM liquidity under a user risk profile");

program
  .command("doctor")
  .option("--address <addr>", "Optional wallet address to probe")
  .action(async (opts) => doctor(opts.address));

for (const commandName of ["status", "run"] as const) {
  program
    .command(commandName)
    .requiredOption("--pool-id <id>", "Bitflow pool id, e.g. dlmm_1")
    .requiredOption("--risk-profile <profile>", "low | balanced | high")
    .requiredOption("--deployable-balance-usd <usd>", "User deployable balance in USD terms")
    .option("--address <addr>", "Optional wallet address for reporting context")
    .option("--current-pool-allocation-usd <usd>", "Current USD already allocated to this pool", "0")
    .option("--add-amount-usd <usd>", "Proposed additional USD size to add", "0")
    .option("--max-pool-allocation-pct <pct>", "Override max allocation to this pool in percent")
    .option("--max-single-pool-concentration-pct <pct>", "Override max current pool concentration percent")
    .option("--max-slippage-bps <bps>", "Override max tolerated slippage in basis points")
    .action(async (opts) => {
      const profile = String(opts.riskProfile).toLowerCase() as RiskProfile;
      if (!["low", "balanced", "high"].includes(profile)) {
        fail("invalid_risk_profile", "Risk profile must be low, balanced, or high", "Pass one of: low | balanced | high");
      }
      await evaluate({
        address: opts.address,
        poolId: opts.poolId,
        riskProfile: profile,
        deployableBalanceUsd: Number(opts.deployableBalanceUsd),
        currentPoolAllocationUsd: Number(opts.currentPoolAllocationUsd),
        addAmountUsd: Number(opts.addAmountUsd),
        maxPoolAllocationPct: opts.maxPoolAllocationPct ? Number(opts.maxPoolAllocationPct) : undefined,
        maxSinglePoolConcentrationPct: opts.maxSinglePoolConcentrationPct ? Number(opts.maxSinglePoolConcentrationPct) : undefined,
        maxSlippageBps: opts.maxSlippageBps ? Number(opts.maxSlippageBps) : undefined,
      });
    });
}

program.parseAsync().catch((error) => {
  fail(
    "unhandled",
    error instanceof Error ? error.message : String(error),
    "Inspect the stack and retry"
  );
});
