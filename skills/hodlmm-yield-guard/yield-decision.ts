#!/usr/bin/env bun

type DecisionInput = {
  currentYield: number;
  bestAvailableYield: number;
  minAcceptableYield: number;
  minRotationDelta: number;
};

export function decideYieldAction(input: DecisionInput): 'stay' | 'rotate' | 'alert' {
  const { currentYield, bestAvailableYield, minAcceptableYield, minRotationDelta } = input;
  if (currentYield >= minAcceptableYield) return 'stay';
  const improvement = bestAvailableYield - currentYield;
  if (bestAvailableYield >= minAcceptableYield && improvement >= minRotationDelta) return 'rotate';
  return 'alert';
}

if (import.meta.main) {
  const payload = JSON.parse(process.argv[2] || '{}') as DecisionInput;
  console.log(JSON.stringify({ decision: decideYieldAction(payload), input: payload }, null, 2));
}
