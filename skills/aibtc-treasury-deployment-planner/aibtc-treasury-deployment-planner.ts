#!/usr/bin/env bun

import { Command } from 'commander';
import { createHash } from 'crypto';

type PlannerDecision = 'hold' | 'reserve-for-outreach' | 'rotate-to-yield';

const VERSION = '0.1.0';
const DEFAULTS = {
  satsPerOutboundMessage: 100,
  minMeaningfulYieldApy: 6,
  minCommercialProfiles: 2,
  minStxRunway: 5,
};

function print(obj: unknown) {
  console.log(JSON.stringify(obj, null, 2));
}

function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex');
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

function fail(code: string, message: string, next: string) {
  print({ status: 'error', action: 'inspect-inputs', data: {}, error: { code, message, next } });
  process.exit(1);
}

async function doctor() {
  print({
    status: 'success',
    action: 'ready',
    data: {
      skill: 'aibtc-treasury-deployment-planner',
      version: VERSION,
      defaults: DEFAULTS,
      checks: {
        bun: typeof Bun !== 'undefined',
        crypto: true,
        fetch: true,
      },
    },
    error: null,
  });
}

async function status() {
  print({
    status: 'success',
    action: 'show-status',
    data: {
      skill: 'aibtc-treasury-deployment-planner',
      version: VERSION,
      defaults: DEFAULTS,
    },
    error: null,
  });
}

async function run(opts: { stxBalance?: string; yieldApy?: string; outboundMessages?: string; satsPerOutboundMessage?: string; }) {
  const stxBalance = Number(opts.stxBalance ?? NaN);
  const yieldApy = Number(opts.yieldApy ?? NaN);
  const outboundMessages = Number(opts.outboundMessages ?? 0);
  const satsPerOutboundMessage = Number(opts.satsPerOutboundMessage ?? DEFAULTS.satsPerOutboundMessage);

  if (!Number.isFinite(stxBalance) || stxBalance < 0) fail('INVALID_STX_BALANCE', 'stx-balance must be a non-negative number', 'Pass --stx-balance <amount>.');
  if (!Number.isFinite(yieldApy) || yieldApy < 0) fail('INVALID_YIELD_APY', 'yield-apy must be a non-negative number', 'Pass --yield-apy <apy>.');
  if (!Number.isFinite(outboundMessages) || outboundMessages < 0) fail('INVALID_OUTBOUND_MESSAGES', 'outbound-messages must be a non-negative number', 'Pass --outbound-messages <count>.');

  const leaderboard = await fetchJson('https://aibtc.com/api/leaderboard');
  const entries = leaderboard?.leaderboard ?? leaderboard ?? [];
  const commercialProfilesSeen = entries.filter((x: any) => {
    const d = String(x?.description ?? '').toLowerCase();
    return d.includes('bounty') || d.includes('x402') || d.includes('sats') || d.includes('api/') || d.includes('paid');
  }).length;

  const reservedMessageCostSats = outboundMessages * satsPerOutboundMessage;
  const reasons: string[] = [];
  let decision: PlannerDecision = 'hold';

  if (stxBalance < DEFAULTS.minStxRunway) {
    decision = 'hold';
    reasons.push('treasury_runway_too_small');
  } else if (outboundMessages > 0 && commercialProfilesSeen >= DEFAULTS.minCommercialProfiles) {
    decision = 'reserve-for-outreach';
    reasons.push('commercial_density_visible');
    reasons.push('message_budget_should_stay_liquid');
  } else if (yieldApy >= DEFAULTS.minMeaningfulYieldApy) {
    decision = 'rotate-to-yield';
    reasons.push('yield_surface_above_minimum');
  } else {
    decision = 'hold';
    reasons.push('yield_not_meaningful_enough');
  }

  const now = new Date().toISOString();
  const proof = {
    skill: 'aibtc-treasury-deployment-planner',
    version: VERSION,
    timestamp: now,
    decision,
    checks: {
      stxBalance,
      yieldApy,
      outboundMessages,
      reservedMessageCostSats,
      commercialProfilesSeen,
    },
  };

  print({
    status: 'success',
    action: decision,
    data: {
      decision,
      reasons,
      checks: {
        stxBalance,
        yieldApy,
        outboundMessages,
        reservedMessageCostSats,
        commercialProfilesSeen,
      },
      proof: {
        skill: 'aibtc-treasury-deployment-planner',
        timestamp: now,
        hash: sha256Hex(JSON.stringify(proof)),
      },
    },
    error: null,
  });
}

const program = new Command();
program.name('aibtc-treasury-deployment-planner');
program.command('doctor').action(doctor);
program.command('status').action(status);
program.command('run')
  .requiredOption('--stx-balance <amount>')
  .requiredOption('--yield-apy <apy>')
  .option('--outbound-messages <count>', 'planned outbound paid messages', '0')
  .option('--sats-per-outbound-message <sats>', 'default 100 sats', String(DEFAULTS.satsPerOutboundMessage))
  .action(run);

program.parseAsync(process.argv).catch((error) => {
  fail('UNHANDLED', error instanceof Error ? error.message : String(error), 'Inspect inputs and retry.');
});
