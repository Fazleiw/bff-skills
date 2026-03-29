## What this skill does

HODLMM Execution Guardrail is a read-only infrastructure primitive for Bitflow HODLMM workflows. It is not a strategy engine and does not place trades. Instead, it acts as a fail-closed control layer that other agents can call before entering any HODLMM action path.

The skill evaluates live Bitflow pool context and returns a deterministic decision:
- `allow`
- `hold`
- `block`

In v1, the guardrail is intentionally narrow and conservative. It checks:
- live APY availability for the target HODLMM pool
- APY drawdown from the pool's recent max APY context
- local cooldown state to prevent repeated noisy action attempts

This is designed as reusable infrastructure for downstream HODLMM rebalance, migration, and monitor-triggered workflows.

## Why this matters

The Bitflow / AIBTC competition already has many monitoring, dashboard, and signal-style submissions. This skill takes a different role: it is a reusable execution guard that can sit in front of those strategies and stop agents from acting on degraded pool conditions blindly.

That makes it more of an agent infrastructure primitive than a trading signal.

## HODLMM integration

Yes — this skill directly integrates HODLMM pool data from Bitflow.

It is specifically designed for HODLMM-aware agent workflows and is meant to gate downstream HODLMM actions using deterministic pool-level checks.

## On-chain proof / live proof

This skill is read-only and does not broadcast transactions in v1.

Live proof attached via command output:

### doctor
```bash
bun run skills/hodlmm-execution-guardrail/hodlmm-execution-guardrail.ts doctor
```

### status
```bash
bun run skills/hodlmm-execution-guardrail/hodlmm-execution-guardrail.ts status
```

### run
```bash
bun run skills/hodlmm-execution-guardrail/hodlmm-execution-guardrail.ts run --pool-id xyk-pool-sbtc-stx-v-1-1 --address SP137SY7VWJFMVBF9GMCSQ2GETC1FV5FYZVKXSMJ8
```

Observed live result:
- decision: `block`
- reasons:
  - `cooldown_active`
  - `apy_drawdown_above_limit`

Observed proof hash:
- `5bfcca091ee7b814b1a2deea1746cdc55fb8328e5eb36fa58a862123db71810f`

## Smoke test results

- `doctor` ✅
- `status` ✅
- `run` ✅

## Notes / constraints

- v1 is a **pool-level** guardrail, not a wallet-specific live position parser
- APY drawdown is a conservative heuristic using live current APY vs recent max APY context exposed by Bitflow
- read-only by design
- fail-closed by design
