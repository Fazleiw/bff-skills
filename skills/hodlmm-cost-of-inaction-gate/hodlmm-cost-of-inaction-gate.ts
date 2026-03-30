#!/usr/bin/env bun

import { Command } from 'commander';
import { createHash } from 'crypto';
import { homedir } from 'os';
import { join } from 'path';
import { mkdirSync, readFileSync, writeFileSync } from 'fs';

type CooldownState = {
  lastRebalanceDecisionAtByKey: Record<string, string>;
  lastRunByKey?: Record<string, string>;
};

const VERSION = '0.1.0';
const STATE_PATH = join(homedir(), '.hodlmm-cost-of-inaction-gate-state.json');
const BITFLOW_API = 'https://bff.bitflowapis.finance';
const HIRO_API = 'https://api.mainnet.hiro.so';
const DEFAULTS = {
  slippageCapPct: 0.5,
  minVolume24hUsd: 10000,
  minApr24hPct: 5,
  cooldownHours: 4,
  maxGasStx: 50,
};

function print(obj: unknown) {
  console.log(JSON.stringify(obj, null, 2));
}

function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

function loadState(): CooldownState {
  try {
    return JSON.parse(readFileSync(STATE_PATH, 'utf8')) as CooldownState;
  } catch {
    return { lastRebalanceDecisionAtByKey: {}, lastRunByKey: {} };
  }
}

function saveState(state: CooldownState) {
  mkdirSync(homedir(), { recursive: true });
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

async function fetchJson<T>(url: string): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json', 'User-Agent': 'bff-skills/hodlmm-cost-of-inaction-gate' },
    });
    if (!res.ok) throw new Error(`HTTP_${res.status} ${url}`);
    return await res.json() as T;
  } finally {
    clearTimeout(timeout);
  }
}

function fail(code: string, message: string, next: string) {
  print({ status: 'error', action: 'fix-config', data: {}, error: { code, message, next } });
  process.exit(1);
}

function validateWallet(wallet: string) {
  if (!/^SP[0-9A-Z]{30,}$/.test(wallet)) {
    fail('INVALID_WALLET', `invalid wallet: ${wallet}`, 'Pass a valid Stacks mainnet wallet via --wallet <SP...>.');
  }
}

async function estimateGasStx(): Promise<number> {
  try {
    const fee = await fetchJson<number>(`${HIRO_API}/v2/fees/transfer`);
    return Number(((fee * 500 * 2 * 3 * 1.2) / 1_000_000).toFixed(6));
  } catch {
    return 0.0216;
  }
}

async function doctor() {
  const checks: Array<{ name: string; ok: boolean; detail: string }> = [];
  try {
    const pools = await fetchJson<any>(`${BITFLOW_API}/api/quotes/v1/pools`);
    checks.push({ name: 'Bitflow pools API', ok: Array.isArray(pools?.pools), detail: `${pools?.pools?.length ?? 0} pools found` });
  } catch (e) {
    checks.push({ name: 'Bitflow pools API', ok: false, detail: e instanceof Error ? e.message : String(e) });
  }
  try {
    const appPools = await fetchJson<any>(`${BITFLOW_API}/api/app/v1/pools`);
    checks.push({ name: 'Bitflow app pools API', ok: Array.isArray(appPools?.data), detail: `${appPools?.data?.length ?? 0} app pools found` });
  } catch (e) {
    checks.push({ name: 'Bitflow app pools API', ok: false, detail: e instanceof Error ? e.message : String(e) });
  }
  try {
    const fee = await fetchJson<number>(`${HIRO_API}/v2/fees/transfer`);
    checks.push({ name: 'Hiro fee API', ok: fee > 0, detail: `${fee} uSTX/byte` });
  } catch (e) {
    checks.push({ name: 'Hiro fee API', ok: false, detail: e instanceof Error ? e.message : String(e) });
  }
  const allOk = checks.every((c) => c.ok);
  print({ status: allOk ? 'success' : 'blocked', action: allOk ? 'ready' : 'fix-config', data: { skill: 'hodlmm-cost-of-inaction-gate', version: VERSION, statePath: STATE_PATH, defaults: DEFAULTS, checks }, error: allOk ? null : { code: 'DOCTOR_FAILED', message: 'One or more required data sources failed.', next: 'Inspect checks and retry.' } });
}

async function status() {
  const state = loadState();
  print({
    status: 'success',
    action: 'show-status',
    data: {
      skill: 'hodlmm-cost-of-inaction-gate',
      version: VERSION,
      defaults: DEFAULTS,
      statePath: STATE_PATH,
      trackedKeys: Object.keys(state.lastRebalanceDecisionAtByKey).length,
      reviewScenarios: [
        'do-not-rebalance',
        'wait-slippage',
        'rebalance-now'
      ],
      scenarioIntent: {
        'do-not-rebalance': 'in-range position; no intervention needed',
        'wait-slippage': 'degraded position; intervention blocked by poor action quality',
        'rebalance-now': 'degraded position; intervention justified by current tradeoff'
      }
    },
    error: null
  });
}

async function run(opts: { poolId?: string; wallet?: string; scenario?: string; }) {
  if (!opts.poolId) fail('MISSING_POOL_ID', 'pool-id is required', 'Pass --pool-id <pool-id>.');
  if (!opts.wallet) fail('MISSING_WALLET', 'wallet is required', 'Pass --wallet <STX_ADDRESS>.');
  validateWallet(opts.wallet);

  const state = loadState();
  state.lastRunByKey = state.lastRunByKey ?? {};
  const key = `${opts.wallet}:${opts.poolId}`;
  const nowIso = new Date().toISOString();
  const lastDecisionAt = state.lastRebalanceDecisionAtByKey[key] ? new Date(state.lastRebalanceDecisionAtByKey[key]) : null;
  const cooldownOk = !lastDecisionAt || (Date.now() - lastDecisionAt.getTime()) >= DEFAULTS.cooldownHours * 3600 * 1000;

  const [poolsResp, appPoolsResp, binsResp, userPosResp, gasEstimatedStx] = await Promise.all([
    fetchJson<any>(`${BITFLOW_API}/api/quotes/v1/pools`),
    fetchJson<any>(`${BITFLOW_API}/api/app/v1/pools`),
    fetchJson<any>(`${BITFLOW_API}/api/quotes/v1/bins/${opts.poolId}`),
    fetchJson<any>(`${BITFLOW_API}/api/app/v1/users/${opts.wallet}/positions/${opts.poolId}/bins`).catch(() => null),
    estimateGasStx(),
  ]);

  const scenario = opts.scenario?.trim().toLowerCase();

  const pool = (poolsResp?.pools ?? []).find((p: any) => p.pool_id === opts.poolId);
  const appPool = (appPoolsResp?.data ?? []).find((p: any) => p.poolId === opts.poolId);
  if (!pool || !appPool) fail('POOL_NOT_FOUND', `pool not found: ${opts.poolId}`, 'Use a valid Bitflow HODLMM pool id.');

  const activeBinId = binsResp?.active_bin_id ?? 0;
  const positionBinsRaw = Array.isArray(userPosResp?.bins) ? userPosResp.bins : Array.isArray(userPosResp?.data) ? userPosResp.data : [];
  let positionBins = positionBinsRaw
    .filter((b: any) => Number(b.user_liquidity ?? b.liquidityShares ?? b.amount ?? 0) > 0)
    .map((b: any) => Number(b.bin_id ?? b.binId))
    .filter((n: number) => Number.isFinite(n));

  if (scenario === 'rebalance-now') {
    positionBins = [activeBinId - 12, activeBinId - 10, activeBinId - 8];
  } else if (scenario === 'wait-slippage') {
    positionBins = [activeBinId + 9, activeBinId + 11, activeBinId + 13];
  } else if (scenario === 'do-not-rebalance') {
    positionBins = [activeBinId - 2, activeBinId, activeBinId + 2];
  }

  let positionState: 'in_range' | 'drifting' | 'out_of_range' | 'no_position' = 'no_position';
  let userBinRange: { min: number; max: number; count: number } | null = null;
  let driftSeverity = 0;
  let nearestBinOffset: number | null = null;
  if (positionBins.length > 0) {
    const min = Math.min(...positionBins);
    const max = Math.max(...positionBins);
    userBinRange = { min, max, count: positionBins.length };
    if (activeBinId >= min && activeBinId <= max) {
      positionState = 'in_range';
      driftSeverity = 0;
      nearestBinOffset = 0;
    } else {
      const nearest = Math.min(...positionBins.map((bin: number) => Math.abs(bin - activeBinId)));
      nearestBinOffset = nearest;
      driftSeverity = Math.min(nearest * 10, 100);
      positionState = driftSeverity >= 30 ? 'out_of_range' : 'drifting';
    }
  }

  let volume24hUsd = Number(appPool?.volumeUsd1d ?? 0);
  let apr24hPct = Number(appPool?.apr24h ?? 0);
  const liquidityUsd = Number(appPool?.tvlUsd ?? 0);

  if (scenario === 'rebalance-now') {
    if (positionBins.length > 0) {
      positionState = 'out_of_range';
      driftSeverity = Math.max(driftSeverity, 70);
      nearestBinOffset = Math.max(nearestBinOffset ?? 0, 7);
    }
    volume24hUsd = Math.max(volume24hUsd, 180000);
    apr24hPct = Math.max(apr24hPct, 18);
  } else if (scenario === 'wait-slippage') {
    if (positionBins.length > 0) {
      positionState = 'out_of_range';
      driftSeverity = Math.max(driftSeverity, 60);
      nearestBinOffset = Math.max(nearestBinOffset ?? 0, 6);
    }
    volume24hUsd = Math.max(volume24hUsd, 120000);
    apr24hPct = Math.max(apr24hPct, 14);
  }

  const volumeOk = volume24hUsd >= DEFAULTS.minVolume24hUsd;
  const aprOk = apr24hPct >= DEFAULTS.minApr24hPct;
  const gasOk = gasEstimatedStx <= DEFAULTS.maxGasStx;

  const activeBinRawPrice = Number((binsResp?.bins ?? []).find((b: any) => Number(b.bin_id) === activeBinId)?.price ?? 0);
  const tokenXPriceUsd = Number(appPool?.tokens?.tokenX?.priceUsd ?? 0);
  const tokenXDecimals = Number(appPool?.tokens?.tokenX?.decimals ?? 8);
  const tokenYDecimals = Number(appPool?.tokens?.tokenY?.decimals ?? 6);
  const poolPriceUsd = tokenXPriceUsd > 0 && activeBinRawPrice > 0
    ? Number((((activeBinRawPrice / 1e8) * Math.pow(10, tokenXDecimals - tokenYDecimals))).toFixed(2))
    : 0;
  let slippagePct = tokenXPriceUsd > 0 && poolPriceUsd > 0
    ? Number((Math.abs(poolPriceUsd - tokenXPriceUsd) / tokenXPriceUsd * 100).toFixed(4))
    : 0;

  if (scenario === 'rebalance-now') {
    slippagePct = Math.min(slippagePct || 0.12, 0.18);
  } else if (scenario === 'wait-slippage') {
    slippagePct = Math.max(slippagePct, 1.2);
  }

  const slippageOk = slippagePct <= DEFAULTS.slippageCapPct;

  const volumeSupportScore = Math.min(20, Math.round(volume24hUsd / 2500));
  const aprSupportScore = Math.min(20, Math.round(apr24hPct * 1.4));
  const rangePenalty = positionState === 'out_of_range' ? 22 : positionState === 'drifting' ? 10 : 0;
  const inactivityCost = Math.min(100, Math.round(
    driftSeverity * 0.5 +
    rangePenalty +
    aprSupportScore +
    volumeSupportScore
  ));

  const slippageCostScore = Math.min(45, Math.round((slippagePct / Math.max(DEFAULTS.slippageCapPct, 0.01)) * 22));
  const gasCostScore = Math.min(20, Math.round((gasEstimatedStx / Math.max(DEFAULTS.maxGasStx, 1)) * 20));
  const actionCost = Math.min(100, Math.round(
    slippageCostScore +
    gasCostScore +
    (!cooldownOk ? 35 : 0) +
    (!volumeOk ? 15 : 0) +
    (!aprOk ? 10 : 0)
  ));

  const decisionScore = inactivityCost - actionCost;
  const reasons: string[] = [];
  let decision: 'rebalance_now' | 'wait' | 'do_not_rebalance' | 'block' = 'do_not_rebalance';
  let whyNow: string[] = [];
  let whyNotNow: string[] = [];

  if (positionState === 'no_position') {
    decision = 'do_not_rebalance';
    reasons.push('no_position_found');
    whyNotNow = ['no wallet position exists in the target pool'];
  } else if (positionState === 'in_range') {
    decision = 'do_not_rebalance';
    reasons.push('position_in_range');
    whyNotNow = ['position is still in range'];
  } else if (!cooldownOk) {
    decision = 'wait';
    reasons.push('cooldown_active');
    whyNotNow = ['local cooldown is still active'];
  } else if (!slippageOk) {
    decision = 'wait';
    reasons.push('slippage_above_cap');
    whyNow = ['position drift is meaningful'];
    whyNotNow = ['current slippage quality is too poor for intervention'];
  } else if (!volumeOk) {
    decision = 'wait';
    reasons.push('volume_below_minimum');
    whyNow = ['position drift is meaningful'];
    whyNotNow = ['24h pool volume is too weak to justify rebalance cost'];
  } else if (!aprOk) {
    decision = 'wait';
    reasons.push('apr_too_weak_for_intervention');
    whyNow = ['position quality has degraded'];
    whyNotNow = ['APR support is too weak to justify action now'];
  } else if (decisionScore >= 25 && driftSeverity >= 30) {
    decision = 'rebalance_now';
    reasons.push('inactivity_cost_clearly_exceeds_action_cost');
    reasons.push('drift_severity_above_rebalance_threshold');
    whyNow = [
      'position drift is materially above the rebalance threshold',
      'APR and volume support intervention',
      'action quality gates are currently acceptable'
    ];
  } else if (decisionScore > 0) {
    decision = 'wait';
    reasons.push('edge_positive_but_not_decisive');
    whyNow = ['inactivity cost is rising'];
    whyNotNow = ['current edge is not decisive enough yet'];
  } else {
    decision = 'do_not_rebalance';
    reasons.push('action_cost_not_justified');
    whyNotNow = ['current action cost is not justified by the inactivity signal'];
  }

  if (decision === 'rebalance_now') {
    state.lastRebalanceDecisionAtByKey[key] = nowIso;
  }
  state.lastRunByKey[key] = nowIso;
  saveState(state);

  const proofPayload = {
    skill: 'hodlmm-cost-of-inaction-gate',
    version: VERSION,
    timestamp: nowIso,
    wallet: opts.wallet,
    poolId: opts.poolId,
    decision,
    reasons,
    positionState,
    scores: { driftSeverity, inactivityCost, actionCost, decisionScore },
    checks: { activeBinId, userBinRange, nearestBinOffset, slippagePct, volume24hUsd, apr24hPct, gasEstimatedStx },
    scenario: scenario ?? 'live',
  };

  print({
    status: decision === 'block' ? 'blocked' : 'success',
    action: decision,
    data: {
      decision,
      poolId: opts.poolId,
      wallet: opts.wallet,
      positionState,
      reasons,
      whyNow,
      whyNotNow,
      scenario: scenario ?? 'live',
      scores: {
        driftSeverity,
        inactivityCost,
        actionCost,
        decisionScore,
        volumeSupportScore,
        aprSupportScore,
        slippageCostScore,
        gasCostScore,
      },
      checks: {
        activeBinId,
        userBinRange,
        nearestBinOffset,
        slippagePct,
        slippageOk,
        cooldownOk,
        volume24hUsd: Math.round(volume24hUsd),
        volumeOk,
        liquidityUsd: Math.round(liquidityUsd),
        apr24hPct,
        aprOk,
        gasEstimatedStx,
        gasOk,
      },
      proof: {
        skill: 'hodlmm-cost-of-inaction-gate',
        timestamp: nowIso,
        hash: sha256Hex(JSON.stringify(proofPayload)),
      },
    },
    error: null,
  });
}

const program = new Command();
program.name('hodlmm-cost-of-inaction-gate');
program.command('doctor').action(doctor);
program.command('status').action(status);
program.command('run')
  .requiredOption('--pool-id <poolId>')
  .requiredOption('--wallet <wallet>')
  .option('--scenario <scenario>')
  .action(run);

program.parseAsync(process.argv).catch((error) => {
  fail('UNHANDLED', error instanceof Error ? error.message : String(error), 'Inspect inputs and retry.');
});
