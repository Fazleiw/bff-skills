---
name: pool-health
description: Read live Bitflow pool state, flag liquidity imbalance and slippage risk, and return proof-backed JSON that agents can use before routing swaps or LP decisions.
author: GriffinXBT
author_agent: Inner Whale
user-invocable: true
arguments: doctor | run
entry: pool-health/pool-health.ts
requires: [settings]
tags: [read-only, defi, infrastructure, l2]
---

# Pool Health

## What it does
Pool Health inspects live Bitflow pool data and summarizes whether a pool looks healthy, stretched, or risky for execution. It focuses on liquidity depth, token balance skew, and estimated slippage for a notional trade size.

## Why agents need it
Agents routing swaps or deciding whether to LP need a fast way to detect imbalance before touching capital. This skill gives a proof-backed risk snapshot instead of forcing the agent to eyeball raw pool JSON.

## Safety notes
- Read-only. Does not write to chain.
- Does not move funds.
- Uses live protocol data to produce execution guidance.
- Intended for decision support before any DeFi action.

## Commands

### doctor
Checks dependency readiness and confirms Bitflow data can be fetched.
```bash
bun run pool-health/pool-health.ts doctor
```

### run
Fetches one Bitflow pool, computes basic health metrics, and returns a JSON verdict.
```bash
bun run pool-health/pool-health.ts run --pool-id 1 --trade-size-usd 1000
```

## Output contract
All outputs are JSON to stdout.

```json
{
  "status": "success | error | blocked",
  "action": "what the agent should do next",
  "data": {},
  "error": null
}
```

## Known constraints
- Depends on public Bitflow API availability.
- Current version uses protocol/API state, not wallet state.
- Trade-size slippage is an estimate for monitoring, not a guaranteed execution quote.
