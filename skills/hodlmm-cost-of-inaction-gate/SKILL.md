---
name: hodlmm-cost-of-inaction-gate
description: "Fail-closed HODLMM decision gate that estimates whether staying idle is more costly than rebalancing now, using live wallet position drift, pool conditions, and hard safety constraints."
metadata:
  author: "Fazleiw"
  author-agent: "Inner Whale"
  user-invocable: "false"
  arguments: "doctor | status | run [--scenario <name>]"
  entry: "hodlmm-cost-of-inaction-gate/hodlmm-cost-of-inaction-gate.ts"
  requires: "settings"
  tags: "defi, infrastructure, read-only, mainnet-only, l2"
---

# HODLMM Cost-of-Inaction Gate

## What it does
HODLMM Cost-of-Inaction Gate is a read-only decision primitive for Bitflow HODLMM LP agents. It answers one narrow operational question:

**is staying idle now more costly than rebalancing now?**

The skill reads a wallet's live position bins, compares them against the pool's active bin, measures drift severity, and weighs a conservative inactivity-cost proxy against a conservative action-cost proxy.

It is designed to answer a narrower and more economically useful question than a generic HODLMM monitor:
**is it more expensive to stay idle now than to pay the current quality-adjusted cost of rebalancing?**

In v1, the inactivity-cost side is driven by wallet drift severity, out-of-range state, APR support, and 24h volume support. The action-cost side is driven by slippage quality, gas quality, cooldown, and minimum pool quality gates. The goal is not exact PnL prediction; the goal is conservative timing discipline.

It then emits one of four actions:
- `rebalance_now`
- `wait`
- `do_not_rebalance`
- `block`

## Why agents need it
Being out of range is not enough to justify a rebalance. Rebalancing too early or under poor pool conditions can waste gas, force bad execution, or overtrade shallow/low-quality liquidity.

Agents need a fail-closed control layer that decides whether the current cost of doing nothing is actually high enough to justify intervention.

This is the core wedge of the skill:
- not every degraded position should be touched
- not every live pool deserves intervention
- and not every out-of-range condition is economically actionable right now

## HODLMM integration
This skill directly integrates with live Bitflow HODLMM pool state and wallet-specific position bins. In v1 it evaluates:
- whether the wallet currently has an in-range or out-of-range position
- how far the position has drifted from the active bin
- whether pool APR and 24h volume support meaningful intervention
- whether slippage, gas, and cooldown conditions make action quality too poor right now

The result is not a rebalance executor. It is a conservative rebalance timing gate.

That distinction matters: this skill is designed to sit in front of downstream HODLMM workflows as a reusable control primitive, not to compete with dashboards or broad optimizers.

## Commands

### doctor
Checks runtime dependencies and confirms the skill can reach the required public data sources.

```bash
bun run skills/hodlmm-cost-of-inaction-gate/hodlmm-cost-of-inaction-gate.ts doctor
```

### status
Returns configured thresholds, local state metadata, and the built-in review scenario pack.

```bash
bun run skills/hodlmm-cost-of-inaction-gate/hodlmm-cost-of-inaction-gate.ts status
```

### run
Evaluates whether the current inactivity cost justifies rebalancing now.

```bash
bun run skills/hodlmm-cost-of-inaction-gate/hodlmm-cost-of-inaction-gate.ts run --pool-id dlmm_1 --wallet SP1234...
```

Deterministic scenario harness for review / testing:
```bash
bun run skills/hodlmm-cost-of-inaction-gate/hodlmm-cost-of-inaction-gate.ts run --pool-id dlmm_1 --wallet SP1234... --scenario do-not-rebalance
bun run skills/hodlmm-cost-of-inaction-gate/hodlmm-cost-of-inaction-gate.ts run --pool-id dlmm_1 --wallet SP1234... --scenario wait-slippage
bun run skills/hodlmm-cost-of-inaction-gate/hodlmm-cost-of-inaction-gate.ts run --pool-id dlmm_1 --wallet SP1234... --scenario rebalance-now
```

Example decision patterns:
- `rebalance_now` when the position is materially out of range, pool support is strong, and the inactivity-cost signal clearly exceeds the action-cost signal
- `wait` when the position has degraded but slippage, cooldown, APR, or volume quality is too poor
- `do_not_rebalance` when the wallet has no position or is still in range; in-range state short-circuits ahead of action-quality penalties because the position does not need intervention

Live observations from current mainnet reads during development showed why this gate matters:
- some pools were technically queryable but had weak 24h volume, weak APR support, or severe slippage mismatch
- in those cases, the skill refused to manufacture rebalance urgency even when the pool existed and live reads were available
- this fail-closed behavior is intentional: v1 is optimized to avoid low-quality intervention, not to force activity

For reviewer-facing proof, v1 also includes a deterministic scenario harness that injects position-aware states for three interpretable outcomes:
- `do-not-rebalance` → wallet is effectively still in range
- `wait-slippage` → wallet is degraded, but current action quality is poor
- `rebalance-now` → wallet is materially out of range and current action quality is acceptable

## Output contract
All outputs are JSON to stdout.

```json
{
  "status": "success | blocked | error",
  "action": "rebalance_now | wait | do_not_rebalance | block | fix-config",
  "data": {
    "decision": "rebalance_now | wait | do_not_rebalance | block",
    "poolId": "string",
    "wallet": "string",
    "positionState": "in_range | drifting | out_of_range | no_position",
    "reasons": ["string"],
    "scores": {
      "driftSeverity": 62,
      "inactivityCost": 71,
      "actionCost": 28,
      "decisionScore": 43
    },
    "checks": {
      "activeBinId": 504,
      "userBinRange": { "min": 500, "max": 508, "count": 3 },
      "slippagePct": 0.18,
      "slippageOk": true,
      "cooldownOk": true,
      "volume24hUsd": 126045,
      "volumeOk": true,
      "apr24hPct": 17.72,
      "aprOk": true,
      "gasEstimatedStx": 0.0144,
      "gasOk": true
    },
    "proof": {
      "skill": "hodlmm-cost-of-inaction-gate",
      "timestamp": "ISO-8601",
      "hash": "sha256-hex"
    }
  },
  "error": null
}
```

## Safety notes
- Read-only. This skill does **not** submit transactions.
- Mainnet-oriented. It depends on live Bitflow and Hiro reads.
- Fail-closed by design. Missing critical data returns `block` or `error`.
- `rebalance_now` is only a decision recommendation, not permission to skip human review or downstream safeguards.

## Known constraints
- Uses conservative heuristics, not exact PnL forecasting.
- v1 estimates inactivity cost and action cost from live pool state and wallet position drift, not from a full historical fee model.
- If a wallet has no position in the target pool, the skill returns `do_not_rebalance` or `block` depending on context rather than inventing urgency.
- Slippage and gas checks are conservative action-quality guards, not exact execution quotes.
- Bitflow pool conditions can vary sharply across pools; some live pools may be queryable while still failing minimum action-quality thresholds.
- v1 favors narrower scope and stronger refusal logic over broad optimization claims.
