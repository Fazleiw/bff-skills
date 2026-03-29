---
name: hodlmm-execution-guardrail
description: "Fail-closed HODLMM execution guard that blocks unsafe agent actions using deterministic checks on live Bitflow pool state, APY drawdown, and cooldown state."
metadata:
  author: "Fazleiw"
  author-agent: "Inner Whale"
  user-invocable: "false"
  arguments: "doctor | status | run"
  entry: "hodlmm-execution-guardrail/hodlmm-execution-guardrail.ts"
  requires: "settings"
  tags: "defi, infrastructure, read-only, mainnet-only, l2"
---

# HODLMM Execution Guardrail

## What it does
HODLMM Execution Guardrail is a read-only infrastructure skill for agents operating on Bitflow HODLMM pools. It does not generate alpha or place trades. Instead, it answers a narrower operational question: **is current live pool state good enough for an agent to continue into a HODLMM action path at all?**

The skill reads live Bitflow pool data, applies deterministic refusal checks, and emits one of three actions:
- `allow`
- `hold`
- `block`

## Why agents need it
As more AIBTC agents ship Bitflow and HODLMM-related skills, the network needs more than dashboards and yield signals. Agents need a reusable safety primitive that can sit in front of autonomous capital-management logic and prevent low-quality or unsafe execution.

This skill is designed as that control layer. It can be chained before any HODLMM rebalance, migration, monitor-triggered action, or other pool-management workflow so that agents avoid acting on stale or cooldown-violating conditions, or on pools showing severe APY drawdown from recent context.

## HODLMM integration
This skill is directly integrated with live Bitflow HODLMM pool data and conservative local guardrails. In v1 it evaluates:
- whether live HODLMM APY data is available for the target pool
- whether the pool's current APY has drawn down too far from its recent max APY context
- whether a local cooldown is still active from recent evaluation history

The result is not a trade signal. It is a deterministic execution guard for HODLMM-aware agents.

## Commands

### doctor
Checks runtime dependencies and confirms the skill can read its environment safely.

```bash
bun run skills/hodlmm-execution-guardrail/hodlmm-execution-guardrail.ts doctor
```

### status
Returns the currently configured guardrail thresholds and local state file path.

```bash
bun run skills/hodlmm-execution-guardrail/hodlmm-execution-guardrail.ts status
```

### run
Evaluates a HODLMM pool and returns a deterministic execution decision.

```bash
bun run skills/hodlmm-execution-guardrail/hodlmm-execution-guardrail.ts run --pool-id xyk-pool-sbtc-stx-v-1-1 --address SP137SY7VWJFMVBF9GMCSQ2GETC1FV5FYZVKXSMJ8
```

## Decision model
The skill evaluates five guardrail families in order:
1. **Data freshness** — block if required live data cannot be fetched or is inconsistent
2. **Cooldown** — hold if the same pool was checked recently and cooldown is still active
3. **Pool actionability** — hold if the live pool state is not actionable enough for autonomous follow-up
4. **Execution quality** — block if APY drawdown from recent max context exceeds configured limits

## Output contract
All outputs are JSON to stdout.

```json
{
  "status": "success | error | blocked",
  "action": "allow | hold | block | fix-config | inspect-position",
  "data": {
    "decision": "allow | hold | block",
    "poolId": "string",
    "address": "string",
    "reasons": ["string"],
    "checks": {
      "cooldownActive": false,
      "poolActionable": true,
      "apyDrawdownBps": 3400,
      "maxApyDrawdownBps": 9500,
      "currentApy": 12.4,
      "maxApy": 18.8
    },
    "proof": {
      "skill": "hodlmm-execution-guardrail",
      "timestamp": "ISO-8601",
      "hash": "sha256-hex"
    }
  },
  "error": null
}
```

## Safety notes
- Read-only. This skill does **not** submit transactions.
- Mainnet-oriented. It is built for live Bitflow / Stacks reads.
- Fail-closed by design. If required data is missing, stale, or inconsistent, the skill returns `block` or `error` instead of optimistic output.
- This skill is intended to be called **before** autonomous HODLMM actions, not after.

## Known constraints
- Depends on Bitflow / Hiro / public endpoint availability.
- Does not execute any rebalance or migration itself.
- Uses deterministic local cooldown state to reduce repeated noisy evaluations.
- Guardrail thresholds are intentionally conservative in v1.
- v1 is a pool-level guardrail, not a wallet-specific live position parser.
- APY drawdown is a conservative heuristic based on live current APY versus the pool's recent max APY context exposed by Bitflow.
- Proof output demonstrates deterministic decision packaging, not on-chain execution.
