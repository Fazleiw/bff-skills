#!/usr/bin/env bun

import { decideYieldAction } from './yield-decision';

function arg(name: string, fallback?: string) {
  const idx = process.argv.indexOf(name);
  return idx >= 0 && process.argv[idx + 1] ? process.argv[idx + 1] : fallback;
}

function out(payload: any, code = 0) {
  console.log(JSON.stringify(payload, null, 2));
  process.exit(code);
}

const command = process.argv[2];

if (command === 'doctor') {
  out({
    status: 'success',
    action: 'Yield guard ready.',
    data: {
      commands: ['doctor', 'run'],
      focus: 'HODLMM-first threshold-based yield decisioning'
    },
    error: null
  });
}

if (command === 'run') {
  const currentYield = Number(arg('--current-yield', '0'));
  const bestAvailableYield = Number(arg('--best-yield', '0'));
  const minAcceptableYield = Number(arg('--min-acceptable-yield', '0'));
  const minRotationDelta = Number(arg('--min-rotation-delta', '0'));

  const decision = decideYieldAction({ currentYield, bestAvailableYield, minAcceptableYield, minRotationDelta });
  out({
    status: 'success',
    action: decision,
    data: {
      currentYield,
      bestAvailableYield,
      minAcceptableYield,
      minRotationDelta,
      decision
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
