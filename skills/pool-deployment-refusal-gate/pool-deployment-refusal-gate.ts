#!/usr/bin/env bun
import { Command } from "commander";
import { createHash } from "crypto";

const DEFAULT_CATEGORY = "DLMM";
const DEFAULT_MIN_VOLUME_24H_USD = 25000;
const DEFAULT_MIN_LIQUIDITY_USD = 100000;
const DEFAULT_MAX_SLIPPAGE_BPS = 150;
const DEFAULT_TRADE_SIZE_USD = 1000;

type Status = "success" | "blocked" | "error";
type Action = "deploy_allowed" | "wait" | "block";

interface SkillOutput {
  status: Status;
  action: Action;
  data: Record<string, unknown>;
  error: { code: string; message: string; next: string } | null;
}

function print(result: SkillOutput): void {
  console.log(JSON.stringify(result, null, 2));
}

function asNum(v: any): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

async function fetchJson(url: string): Promise<any> {
  const res = await fetch(url, { headers: { "user-agent": "pool-deployment-refusal-gate/1.0" } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return await res.json();
}

const BITFLOW_API_BASE = "https://bff.bitflowapis.finance/api/app/v1";

function groupedUrl(category: string): string {
  return `${BITFLOW_API_BASE}/pools?categories=${encodeURIComponent(category)}`;
}

function metricsUrl(): string {
  return `${BITFLOW_API_BASE}/pools/metrics`;
}

function categoriesUrl(): string {
  return `${BITFLOW_API_BASE}/pools/categories`;
}

function flattenPools(payload: any) {
  const pages = Array.isArray(payload?.pages) ? payload.pages : [payload];
  const groups = pages.flatMap((p: any) => Array.isArray(p?.data) ? p.data : Array.isArray(p) ? p : []);
  return groups.flatMap((group: any) => {
    const pair = group?.pair || {};
    const pools = Array.isArray(group?.pools) ? group.pools : [];
    return pools.map((pool: any) => ({
      poolId: String(pool.poolId ?? pool.pool_id ?? pool.id ?? ""),
      poolContract: pool.poolContract ?? pool.pool_id ?? pool.id ?? null,
      category: Array.isArray(pool.types) ? pool.types.join(",") : pool.category ?? null,
      tokenX: pair.tokenX ?? pool.tokenX ?? null,
      tokenY: pair.tokenY ?? pool.tokenY ?? null,
      tvlUsd: asNum(pool.tvlUsd ?? pool.tvl_usd ?? pool?.calculatedData?.tvl_usd ?? 0),
      volume24hUsd: asNum(pool.volumeUsd1d ?? pool.volume_24h_usd ?? 0),
      fees24hUsd: asNum(pool.feesUsd1d ?? pool.fees_24h_usd ?? 0),
      reserve0: asNum(pool?.poolComposition?.tokenX?.liquidityUsd ?? pool?.reserve0 ?? 0),
      reserve1: asNum(pool?.poolComposition?.tokenY?.liquidityUsd ?? pool?.reserve1 ?? 0),
      raw: pool,
      groupRaw: group,
    }));
  });
}

function findPool(payload: any, poolId: string) {
  const rows = flattenPools(payload);
  return rows.find((r: any) => r.poolId === poolId || String(r.poolContract) === poolId) || null;
}

function inspectPool(pool: any, tradeSizeUsd: number, minVolume24hUsd: number, minLiquidityUsd: number, maxSlippageBps: number): SkillOutput {
  const liquidityUsd = Math.max(asNum(pool.tvlUsd), 0);
  const volume24hUsd = Math.max(asNum(pool.volume24hUsd), 0);
  const reserve0 = Math.max(asNum(pool.reserve0), 0);
  const reserve1 = Math.max(asNum(pool.reserve1), 0);
  const effectiveDepthUsd = Math.max(Math.min(reserve0, reserve1), 1);
  const slippageEstimateBps = Math.round((tradeSizeUsd / effectiveDepthUsd) * 10000);

  const volumeOk = volume24hUsd >= minVolume24hUsd;
  const liquidityOk = liquidityUsd >= minLiquidityUsd;
  const slippageOk = slippageEstimateBps <= maxSlippageBps;

  let action: Action = "deploy_allowed";
  let approved = true;
  let reason = "pool currently clears the minimum deployment quality bars";

  if (!liquidityOk || !volumeOk || !slippageOk) {
    action = liquidityUsd <= 0 ? "block" : "wait";
    approved = false;
    if (!liquidityOk && liquidityUsd <= 0) {
      reason = "pool does not expose usable live liquidity, so deployment should be blocked";
    } else if (!liquidityOk) {
      reason = "pool liquidity is below the minimum admission bar, so deployment should wait";
    } else if (!volumeOk) {
      reason = "pool activity is too weak right now to justify fresh deployment";
    } else {
      reason = "estimated entry slippage is too high for fresh deployment right now";
    }
  }

  const timestamp = new Date().toISOString();
  const hash = createHash("sha256")
    .update(JSON.stringify({
      poolId: pool.poolId,
      liquidityUsd,
      volume24hUsd,
      slippageEstimateBps,
      minVolume24hUsd,
      minLiquidityUsd,
      maxSlippageBps,
      timestamp,
    }))
    .digest("hex");

  return {
    status: action === "block" ? "blocked" : "success",
    action,
    data: {
      poolId: pool.poolId,
      checks: {
        volume24hUsd,
        volumeOk,
        liquidityUsd,
        liquidityOk,
        slippageEstimateBps,
        slippageOk,
        reserve0Usd: reserve0,
        reserve1Usd: reserve1,
      },
      decision: {
        approved,
        reason,
        nextAction: action,
      },
      proof: {
        skill: "pool-deployment-refusal-gate",
        timestamp,
        hash,
      },
    },
    error: action === "block"
      ? {
          code: "POOL_BLOCKED",
          message: reason,
          next: "Inspect the live pool state before deploying capital",
        }
      : null,
  };
}

async function doctor(poolId: string, category: string): Promise<void> {
  try {
    const [categories, metrics, grouped] = await Promise.all([
      fetchJson(categoriesUrl()),
      fetchJson(metricsUrl()),
      fetchJson(groupedUrl(category)),
    ]);
    const pool = findPool(grouped, poolId);
    print({
      status: "success",
      action: "wait",
      data: {
        poolId,
        category,
        checks: {
          categoriesReachable: !!categories,
          metricsReachable: !!metrics,
          groupedReachable: !!grouped,
          poolFound: !!pool,
          samplePoolId: pool?.poolId ?? null,
          sampleLiquidityUsd: pool?.tvlUsd ?? null,
          sampleVolume24hUsd: pool?.volume24hUsd ?? null,
        },
        proof: {
          skill: "pool-deployment-refusal-gate",
          timestamp: new Date().toISOString(),
        },
      },
      error: null,
    });
  } catch (e: any) {
    print({
      status: "error",
      action: "block",
      data: {},
      error: {
        code: "DOCTOR_FAILED",
        message: String(e?.message || e),
        next: "Verify the Bitflow beta pool endpoints before using this skill",
      },
    });
  }
}

async function run(poolId: string, category: string, minVolume24hUsd: number, minLiquidityUsd: number, maxSlippageBps: number): Promise<void> {
  try {
    const grouped = await fetchJson(groupedUrl(category));
    const pool = findPool(grouped, poolId);
    if (!pool) {
      print({
        status: "blocked",
        action: "block",
        data: {},
        error: {
          code: "POOL_NOT_FOUND",
          message: `No matching pool was found for ${poolId}`,
          next: "Inspect the pool id or category before running deployment admission",
        },
      });
      return;
    }

    const result = inspectPool(pool, DEFAULT_TRADE_SIZE_USD, minVolume24hUsd, minLiquidityUsd, maxSlippageBps);
    print(result);
  } catch (e: any) {
    print({
      status: "error",
      action: "block",
      data: {},
      error: {
        code: "RUN_FAILED",
        message: String(e?.message || e),
        next: "Retry when Bitflow grouped pool reads recover",
      },
    });
  }
}

const program = new Command();
program.name("pool-deployment-refusal-gate").description("Fail-closed pool admission control for fresh deployment");

program
  .command("doctor")
  .requiredOption("--pool-id <id>", "Pool id to inspect")
  .option("--category <name>", "Pool category", DEFAULT_CATEGORY)
  .action(async (opts) => {
    await doctor(opts.poolId, opts.category);
  });

program
  .command("status")
  .requiredOption("--pool-id <id>", "Pool id to inspect")
  .option("--category <name>", "Pool category", DEFAULT_CATEGORY)
  .option("--min-volume-24h-usd <n>", "Minimum acceptable 24h volume in USD", String(DEFAULT_MIN_VOLUME_24H_USD))
  .option("--min-liquidity-usd <n>", "Minimum acceptable liquidity in USD", String(DEFAULT_MIN_LIQUIDITY_USD))
  .option("--max-slippage-bps <n>", "Maximum acceptable entry slippage estimate in bps", String(DEFAULT_MAX_SLIPPAGE_BPS))
  .action(async (opts) => {
    await run(opts.poolId, opts.category, asNum(opts.minVolume24hUsd), asNum(opts.minLiquidityUsd), asNum(opts.maxSlippageBps));
  });

program
  .command("run")
  .requiredOption("--pool-id <id>", "Pool id to inspect")
  .option("--category <name>", "Pool category", DEFAULT_CATEGORY)
  .option("--min-volume-24h-usd <n>", "Minimum acceptable 24h volume in USD", String(DEFAULT_MIN_VOLUME_24H_USD))
  .option("--min-liquidity-usd <n>", "Minimum acceptable liquidity in USD", String(DEFAULT_MIN_LIQUIDITY_USD))
  .option("--max-slippage-bps <n>", "Maximum acceptable entry slippage estimate in bps", String(DEFAULT_MAX_SLIPPAGE_BPS))
  .action(async (opts) => {
    await run(opts.poolId, opts.category, asNum(opts.minVolume24hUsd), asNum(opts.minLiquidityUsd), asNum(opts.maxSlippageBps));
  });

program.parse(process.argv);
