#!/usr/bin/env bun

import { readFileSync } from 'fs';

type PolicyInput = {
  strategy_id: string;
  executor: string;
  executor_stx: string;
  expiry_block: number;
  allowed_protocols: string[];
  allowed_actions: string[];
  allocation: {
    max_total_bps: number;
    max_single_action_bps: number;
  };
};

function out(payload: any, code = 0) {
  console.log(JSON.stringify(payload, null, 2));
  process.exit(code);
}

function arg(name: string, fallback?: string) {
  const idx = process.argv.indexOf(name);
  return idx >= 0 && process.argv[idx + 1] ? process.argv[idx + 1] : fallback;
}

function parsePolicy(raw: string): PolicyInput {
  return JSON.parse(raw);
}

function validateExecution(policy: PolicyInput, action: string, protocol: string, amountBps: number, currentBlock: number) {
  if (policy.executor !== 'inner-whale') {
    return { ok: false, reason: 'Executor mismatch. Only inner-whale is allowed.' };
  }
  if (currentBlock >= policy.expiry_block) {
    return { ok: false, reason: 'Policy expired.' };
  }
  if (!policy.allowed_actions.includes(action)) {
    return { ok: false, reason: 'Action not allowed by committed policy.' };
  }
  if (!policy.allowed_protocols.includes(protocol)) {
    return { ok: false, reason: 'Protocol not allowed by committed policy.' };
  }
  if (amountBps > policy.allocation.max_single_action_bps) {
    return { ok: false, reason: 'Single-action allocation cap exceeded.' };
  }
  return { ok: true, reason: 'Execution allowed under policy.' };
}

async function main() {
  const command = process.argv[2];

  if (command === 'doctor') {
    out({
      status: 'success',
      action: 'Execution wrapper ready.',
      data: {
        commands: ['doctor', 'run'],
        supportedProtocols: ['bitflow', 'hodlmm'],
        executor: 'inner-whale'
      },
      error: null
    });
  }

  if (command === 'run') {
    const rawPolicy = arg('--policy');
    const policyFile = arg('--policy-file');
    const action = arg('--action', 'swap')!;
    const protocol = arg('--protocol', 'hodlmm')!;
    const amountBps = Number(arg('--amount-bps', '500'));
    const currentBlock = Number(arg('--current-block', '100000'));

    if (!rawPolicy && !policyFile) {
      out({
        status: 'blocked',
        action: 'Provide --policy or --policy-file with canonical strategy JSON.',
        data: {},
        error: { code: 'MISSING_POLICY', message: 'Execution wrapper requires policy JSON.', next: 'Pass --policy <json> or --policy-file <path>.' }
      }, 1);
    }

    const policySource = policyFile ? readFileSync(policyFile, 'utf8') : rawPolicy!;
    const policy = parsePolicy(policySource);
    const decision = validateExecution(policy, action, protocol, amountBps, currentBlock);

    if (!decision.ok) {
      out({
        status: 'blocked',
        action: decision.reason,
        data: {
          strategy_id: policy.strategy_id,
          executor: policy.executor,
          protocol,
          action,
          amountBps
        },
        error: { code: 'POLICY_BLOCKED', message: decision.reason, next: 'Change execution params or update committed policy.' }
      }, 1);
    }

    out({
      status: 'success',
      action: 'Execution allowed. Proceed to policy-referenced HODLMM/Bitflow transaction and record it onchain.',
      data: {
        strategy_id: policy.strategy_id,
        executor: policy.executor,
        protocol,
        action,
        amountBps,
        hodlmm: protocol === 'hodlmm' || protocol === 'bitflow',
        next_onchain_steps: [
          'submit underlying protocol transaction',
          'capture tx hash',
          'call record-execution on strategy-registry.clar'
        ]
      },
      error: null
    });
  }

  out({
    status: 'error',
    action: 'Use doctor or run.',
    data: { receivedCommand: command || null },
    error: { code: 'INVALID_COMMAND', message: 'Supported commands are doctor and run.', next: 'Run doctor first, then run.' }
  }, 1);
}

main();
