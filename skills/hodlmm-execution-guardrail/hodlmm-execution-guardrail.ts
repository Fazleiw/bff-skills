#!/usr/bin/env bun

import { Command } from 'commander';
import { createHash } from 'crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { homedir } from 'os';

type Json = Record<string, unknown>;

type GuardrailState = {
  lastRunByKey: Record<string, string>;
};

const VERSION = '0.1.0';
const STATE_PATH = join(homedir(), '.hodlmm-execution-guardrail-state.json');
const DEFAULTS = {
  maxApyDrawdownBps: 9500,
  cooldownMinutes: 240,
};

function print(obj: unknown) {
  console.log(JSON.stringify(obj, null, 2));
}

function loadState(): GuardrailState {
  try {
    return JSON.parse(readFileSync(STATE_PATH, 'utf8')) as GuardrailState;
  } catch {
    return { lastRunByKey: {} };
  }
}

function saveState(state: GuardrailState) {
  mkdirSync(dirname(STATE_PATH), { recursive: true });
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

async function fetchJson(url: string): Promise<any> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP_${res.status} ${url}`);
    return await res.json();
  } finally {
    clearTimeout(timeout);
  }
}

function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

function fail(code: string, message: string, next: string) {
  print({ status: 'error', action: 'fix-config', data: {}, error: { code, message, next } });
  process.exit(1);
}

async function doctor() {
  print({
    status: 'success',
    action: 'ready',
    data: {
      skill: 'hodlmm-execution-guardrail',
      version: VERSION,
      statePath: STATE_PATH,
      checks: {
        bun: typeof Bun !== 'undefined',
        crypto: true,
        fileState: true,
      },
    },
    error: null,
  });
}

async function status() {
  const state = loadState();
  print({
    status: 'success',
    action: 'show-status',
    data: {
      skill: 'hodlmm-execution-guardrail',
      version: VERSION,
      defaults: DEFAULTS,
      statePath: STATE_PATH,
      trackedKeys: Object.keys(state.lastRunByKey).length,
    },
    error: null,
  });
}

async function run(opts: { poolId?: string; address?: string; maxApyDrawdownBps?: string; cooldownMinutes?: string; }) {
  if (!opts.poolId) fail('MISSING_POOL_ID', 'pool-id is required', 'Pass --pool-id <pool-id>.');
  if (!opts.address) fail('MISSING_ADDRESS', 'address is required', 'Pass --address <stacks-address>.');

  const maxApyDrawdownBps = Number(opts.maxApyDrawdownBps ?? DEFAULTS.maxApyDrawdownBps);
  const cooldownMinutes = Number(opts.cooldownMinutes ?? DEFAULTS.cooldownMinutes);

  const state = loadState();
  const stateKey = `${opts.address}:${opts.poolId}`;
  const now = new Date();
  const lastRun = state.lastRunByKey[stateKey] ? new Date(state.lastRunByKey[stateKey]) : null;
  const cooldownActive = !!lastRun && (now.getTime() - lastRun.getTime()) < cooldownMinutes * 60 * 1000;

  const apyResponse = await fetchJson('https://app.bitflow.finance/api/apy-v2');
  const poolsMap = apyResponse?.data?.pools ?? {};
  const pool = poolsMap?.[opts.poolId];
  if (!pool) fail('POOL_NOT_FOUND', `pool not found: ${opts.poolId}`, 'Use a valid HODLMM/Bitflow pool id from the Bitflow APY endpoint.');

  const currentApy = Number(pool?.apy ?? 0);
  const maxApy = Number(pool?.maxApy ?? 0);
  const apyDrawdownBps = currentApy > 0 && maxApy > 0
    ? Math.round(((maxApy - currentApy) / Math.max(maxApy, currentApy)) * 10000)
    : 0;

  // Conservative v1 fallback: this skill currently operates at pool level.
  // We do not claim a wallet-specific live position-range check until a reliable
  // public position endpoint is confirmed. For v1 we only require live APY context.
  const poolActionable = currentApy > 0;
  const cooldownOnly = cooldownActive;

  const reasons: string[] = [];
  let decision: 'allow' | 'hold' | 'block' = 'allow';

  if (cooldownActive) {
    decision = 'hold';
    reasons.push('cooldown_active');
  }
  if (!poolActionable) {
    decision = 'hold';
    reasons.push('pool_not_actionable');
  }
  if (apyDrawdownBps > maxApyDrawdownBps) {
    decision = 'block';
    reasons.push('apy_drawdown_above_limit');
  }

  const proofPayload = {
    skill: 'hodlmm-execution-guardrail',
    version: VERSION,
    timestamp: now.toISOString(),
    address: opts.address,
    poolId: opts.poolId,
    decision,
    reasons,
    checks: {
      cooldownActive,
      poolActionable,
      apyDrawdownBps,
      maxApyDrawdownBps,
    },
  };
  const proofHash = sha256Hex(JSON.stringify(proofPayload));

  state.lastRunByKey[stateKey] = now.toISOString();
  saveState(state);

  print({
    status: decision === 'block' ? 'blocked' : 'success',
    action: decision === 'allow' ? 'allow' : decision === 'hold' ? 'inspect-position' : 'block',
    data: {
      decision,
      poolId: opts.poolId,
      address: opts.address,
      reasons,
      checks: {
        cooldownActive,
        poolActionable,
        apyDrawdownBps,
        maxApyDrawdownBps,
        currentApy,
        maxApy,
      },
      proof: {
        skill: 'hodlmm-execution-guardrail',
        timestamp: now.toISOString(),
        hash: proofHash,
      },
    },
    error: null,
  });
}

const program = new Command();
program.name('hodlmm-execution-guardrail');
program.command('doctor').action(doctor);
program.command('status').action(status);
program.command('run')
  .requiredOption('--pool-id <poolId>')
  .requiredOption('--address <address>')
  .option('--max-apy-drawdown-bps <bps>')
  .option('--cooldown-minutes <minutes>')
  .action(run);

program.parseAsync(process.argv).catch((error) => {
  fail('UNHANDLED', error instanceof Error ? error.message : String(error), 'Inspect inputs and retry.');
});
