---
name: pool-deployment-refusal-gate
description: "Approves fresh pool deployment only when a live Bitflow pool clears minimum entry-quality bars for liquidity, volume, and execution quality."
metadata:
  author: "Fazleiw"
  author-agent: "Jarvis"
  user-invocable: "false"
  arguments: "doctor | status --pool-id <id> [--category <name>] [--min-volume-24h-usd <n>] [--min-liquidity-usd <n>] [--max-slippage-bps <n>] | run --pool-id <id> [--category <name>] [--min-volume-24h-usd <n>] [--min-liquidity-usd <n>] [--max-slippage-bps <n>]"
  entry: "pool-deployment-refusal-gate/pool-deployment-refusal-gate.ts"
  requires: "settings"
  tags: "read-only, defi, infrastructure, l2"
---

# Pool Deployment Refusal Gate

## What it does
Evaluates one live Bitflow pool and decides whether fresh deployment should be admitted or refused right now. It checks only the minimum entry bars needed for deployment safety: visible liquidity, recent activity, and entry-quality slippage.

This is not a dashboard, allocator, ranker, or optimizer. It is a fail-closed admission primitive that answers one question only: should an agent admit this pool for fresh deployment right now, or refuse entry?

## Why agents need it
A deployment agent should not treat every live pool as equally eligible for new capital. This skill standardizes a clean refusal boundary before any downstream add-liquidity or pool-entry flow runs.

If the pool is live but weak, the skill says wait. If the pool clearly fails minimum bars or the live data is unusable, it blocks. If the pool clears those bars, it emits `deploy_allowed` and nothing more.

## Safety notes
- **Read-only.** This skill does not sign or broadcast transactions.
- **No funds move.** It emits a deployment admission decision only.
- **Fail-closed.** Missing pool data, invalid pool ids, or clearly weak entry conditions produce a wait/block outcome.
- **Not an optimizer.** It does not rank pools or recommend the best pool.
- **No hidden scoring.** Decisions are derived from visible liquidity, volume, and slippage-quality checks in the reviewed files.

## Commands

### doctor
Checks that the proven Bitflow beta pool endpoints are reachable.
```bash
bun run pool-deployment-refusal-gate/pool-deployment-refusal-gate.ts doctor --pool-id dlmm_3 --category DLMM
```

### status
Read-only inspection of whether the requested pool currently clears the minimum deployment bars.
```bash
bun run pool-deployment-refusal-gate/pool-deployment-refusal-gate.ts status --pool-id dlmm_3 --category DLMM --min-volume-24h-usd 25000 --min-liquidity-usd 100000 --max-slippage-bps 150
```

### run
Returns the final deployment admission decision.
```bash
bun run pool-deployment-refusal-gate/pool-deployment-refusal-gate.ts run --pool-id dlmm_3 --category DLMM --min-volume-24h-usd 25000 --min-liquidity-usd 100000 --max-slippage-bps 150
```

## Output contract

All outputs are JSON to stdout.

**Success:**
```json
{
  "status": "success",
  "action": "deploy_allowed|wait|block",
  "data": {
    "poolId": "dlmm_3",
    "checks": {
      "volume24hUsd": 180000,
      "volumeOk": true,
      "liquidityUsd": 190310,
      "liquidityOk": true,
      "slippageEstimateBps": 52,
      "slippageOk": true
    },
    "decision": {
      "approved": true,
      "reason": "pool currently clears the minimum deployment quality bars",
      "nextAction": "deploy_allowed"
    },
    "proof": {
      "skill": "pool-deployment-refusal-gate",
      "timestamp": "2026-04-01T00:00:00.000Z"
    }
  },
  "error": null
}
```

**Blocked/Error:**
```json
{
  "status": "blocked|error",
  "action": "block",
  "data": {},
  "error": {
    "code": "POOL_NOT_FOUND|RUN_FAILED",
    "message": "Descriptive error message",
    "next": "Inspect the pool id or retry when Bitflow reads recover"
  }
}
```

## Known constraints
- This skill evaluates one pool at a time and intentionally refuses to compare pools.
- It is an admission-control primitive, not a routing engine.
- Slippage is an entry-quality estimate derived from live pool depth, not a guaranteed execution quote.
- Strong proof quality depends on honest live pool metrics rather than wallet-specific or tx-specific evidence.
