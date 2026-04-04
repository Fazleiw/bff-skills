---
name: hodlmm-liquidity-suitability-gate
description: "Decide whether a HODLMM liquidity position is safe enough to hold or add to for a specific user risk profile."
metadata:
  author: "griffinxbt"
  author-agent: "Twin Cyrus"
  user-invocable: "false"
  arguments: "doctor | status --pool-id <id> --risk-profile <low|balanced|high> --deployable-balance-usd <usd> [--current-pool-allocation-usd <usd>] [--add-amount-usd <usd>] [--address <addr>] [--max-pool-allocation-pct <pct>] [--max-single-pool-concentration-pct <pct>] [--max-slippage-bps <bps>] | run --pool-id <id> --risk-profile <low|balanced|high> --deployable-balance-usd <usd> [--current-pool-allocation-usd <usd>] [--add-amount-usd <usd>] [--address <addr>] [--max-pool-allocation-pct <pct>] [--max-single-pool-concentration-pct <pct>] [--max-slippage-bps <bps>]"
  entry: "hodlmm-liquidity-suitability-gate/hodlmm-liquidity-suitability-gate.ts"
  requires: "wallet, signing, settings"
  tags: "defi, read-only, mainnet-only, infrastructure, l2"
---

# HODLMM Liquidity Suitability Gate

## What it does
`hodlmm-liquidity-suitability-gate` is a fail-closed HODLMM admission primitive for Bitflow liquidity agents. It answers one narrow operational question: **for this wallet and risk profile, is this HODLMM liquidity position safe enough to hold, and if safe, is it suitable to add more size right now?**

It reads live Bitflow pool state, combines it with user allocation context and a bounded risk profile, and emits one of four deterministic outcomes:
- `block`
- `watch`
- `allow_hold`
- `allow_add`

The decision is driven by concrete hold/add suitability checks only:
- live liquidity depth
- live 24h and 7d activity context
- estimated entry slippage for the proposed add size
- pool composition balance
- current and post-add concentration against the user's risk limits

## Why agents need it
This is not a dashboard, broad optimizer, or portfolio manager.

- `hodlmm-risk` tells an agent whether a pool environment is risky
- `hodlmm-pulse` tells an agent when pool activity is spiking
- `hodlmm-liquidity-suitability-gate` tells an agent whether a specific pool is suitable for this user's capital profile before holding or adding more size

That makes it a reusable control primitive for treasury agents, LP deployers, allocators, and capital-routing workflows that need a profile-aware hold/add decision instead of another broad summary.

## Safety notes
- Read-only: this skill does not submit transactions.
- It does not move funds.
- Mainnet-only: depends on live Bitflow and Hiro read surfaces.
- Fail-closed by design: degraded pool reads or invalid profile inputs return `block` or structured error rather than false safety.
- `allow_add` is a gate output for downstream review, not unconditional permission to deploy capital.

## Commands

### doctor
Checks live Bitflow reachability and optional wallet readability.
```bash
bun run skills/hodlmm-liquidity-suitability-gate/hodlmm-liquidity-suitability-gate.ts doctor --address SP137SY7VWJFMVBF9GMCSQ2GETC1FV5FYZVKXSMJ8
```

### status
Read-only suitability check for a specific pool and profile.
```bash
bun run skills/hodlmm-liquidity-suitability-gate/hodlmm-liquidity-suitability-gate.ts status --pool-id dlmm_1 --risk-profile balanced --deployable-balance-usd 5000 --current-pool-allocation-usd 900 --add-amount-usd 400
```

### run
Core decision path. Returns whether the pool should be blocked, watched, held only, or allowed for additional size.
```bash
bun run skills/hodlmm-liquidity-suitability-gate/hodlmm-liquidity-suitability-gate.ts run --pool-id dlmm_1 --risk-profile balanced --deployable-balance-usd 5000 --current-pool-allocation-usd 900 --add-amount-usd 400
```

## Output contract
All outputs are JSON to stdout.

**Success:**
```json
{
  "status": "success",
  "action": "Pool needs caution before any new capital is added",
  "data": {
    "decision": "watch",
    "suitability": "caution",
    "poolId": "dlmm_1",
    "riskProfile": "balanced",
    "checks": {
      "deployableBalanceUsd": 5000,
      "currentPoolAllocationUsd": 900,
      "addAmountUsd": 400,
      "nextPoolAllocationPct": 26,
      "recentActivityRatio": 0.0034,
      "slippageEstimateBps": 53,
      "imbalanceRatio": 1.5253,
      "poolVerified": false,
      "sbtcIncentives": false
    },
    "thresholds": {
      "maxPoolAllocationPct": 30,
      "maxSinglePoolConcentrationPct": 35,
      "maxSlippageBps": 150
    },
    "reasons": [
      "pool_volume_below_profile_floor"
    ]
  },
  "error": null
}
```

**Blocked:**
```json
{
  "status": "blocked",
  "action": "Do not add capital to this pool under current conditions",
  "data": {
    "decision": "block",
    "suitability": "not_suitable"
  },
  "error": {
    "code": "pool_not_suitable_for_profile",
    "message": "Pool conditions and allocation profile do not support adding more size",
    "next": "Reduce size, change profile thresholds, or choose a stronger pool"
  }
}
```

## Proof
Live smoke-tested in the BFF repo context.

Observed live smoke paths:
- `doctor` returned `success` with Bitflow pool reachability
- `run --pool-id dlmm_1 --risk-profile balanced --deployable-balance-usd 5000 --current-pool-allocation-usd 900 --add-amount-usd 400` returned `decision: watch`
  - reason: `pool_volume_below_profile_floor`
- `run --pool-id dlmm_1 --risk-profile low --deployable-balance-usd 5000 --current-pool-allocation-usd 900 --add-amount-usd 400` returned `decision: allow_hold`
  - reasons:
    - `pool_liquidity_below_profile_floor`
    - `pool_volume_below_profile_floor`
    - `post_add_allocation_above_limit`

This is valid proof for the primitive because it produced differentiated profile-aware hold/add decisions from live pool conditions rather than a mocked approval path.

## Known constraints
- This primitive evaluates one target pool at a time. It does not optimize a full portfolio.
- User balance/allocation context is passed in explicitly; the skill does not claim full wallet inventory discovery.
- Risk profile presets (`low`, `balanced`, `high`) are deterministic defaults. Numeric overrides can tighten or loosen thresholds.
- Suitability is based on current pool conditions, concentration discipline, and estimated entry quality — not a guarantee of future returns.
