---
name: hodlmm-execution-guardrail
description: "Fail-closed HODLMM execution guard that determines whether downstream Bitflow HODLMM actions should be allowed, held, or blocked under current pool conditions."
metadata:
  author: "Fazleiw"
  author-agent: "Twin Cyrus"
  user-invocable: "false"
  arguments: "doctor | status | run --pool-id <pool> --address <stx-address>"
  entry: "hodlmm-execution-guardrail/hodlmm-execution-guardrail.ts"
  requires: ""
  tags: "defi, read-only, infrastructure, bitflow, hodlmm"
---

# HODLMM Execution Guardrail

## What it does
`hodlmm-execution-guardrail` is a read-only infrastructure primitive for Bitflow HODLMM workflows. It is not a strategy engine and does not place trades. Instead, it acts as a fail-closed control layer that other agents can call before entering any HODLMM action path.

The skill evaluates live Bitflow pool context and returns a deterministic decision:
- `allow`
- `hold`
- `block`

In v1, the guardrail is intentionally narrow and conservative. It checks:
- live APY availability for the target HODLMM pool
- APY drawdown from the pool's recent max APY context
- local cooldown state to prevent repeated noisy action attempts

## Why agents need it
This is not a dashboard, monitor, or rebalance strategy. It is a reusable execution gate that sits in front of downstream HODLMM actions and stops agents from acting on degraded pool conditions blindly.

That makes it more downstream-critical than another measurement layer alone.

## Commands

### doctor
Checks whether live Bitflow and Hiro read paths are reachable.

```bash
bun run skills/hodlmm-execution-guardrail/hodlmm-execution-guardrail.ts doctor
```

### status
Returns current defaults and local state path.

```bash
bun run skills/hodlmm-execution-guardrail/hodlmm-execution-guardrail.ts status
```

### run
Evaluates whether a downstream HODLMM action should be allowed under current pool conditions.

```bash
bun run skills/hodlmm-execution-guardrail/hodlmm-execution-guardrail.ts run --pool-id xyk-pool-sbtc-stx-v-1-1 --address SP137SY7VWJFMVBF9GMCSQ2GETC1FV5FYZVKXSMJ8
```

## Output contract
All commands output JSON to stdout.

### doctor
```json
{
  "status": "success",
  "action": "ready",
  "data": {
    "skill": "hodlmm-execution-guardrail",
    "checks": [
      { "name": "Bitflow pools API", "ok": true, "detail": "8 pools found" },
      { "name": "Bitflow app pools API", "ok": true, "detail": "8 app pools found" },
      { "name": "Hiro fee API", "ok": true, "detail": "8 uSTX/byte" }
    ]
  },
  "error": null
}
```

### run
```json
{
  "status": "success",
  "action": "block",
  "data": {
    "decision": "block",
    "poolId": "xyk-pool-sbtc-stx-v-1-1",
    "wallet": "SP137SY7VWJFMVBF9GMCSQ2GETC1FV5FYZVKXSMJ8",
    "reasons": ["cooldown_active", "apy_drawdown_above_limit"],
    "proof": { "hash": "a56939b873a2ba9a506469e8803b8c1ebe1af248ce2729b0dc412368c391f131" }
  },
  "error": null
}
```

## Safety notes
- Read-only
- No transactions submitted
- No funds moved
- Mainnet-oriented read paths only
- Fails closed on missing live data
- Does not claim wallet-specific live in-range verification in v1; it uses conservative pool/context checks only
