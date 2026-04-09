---
metadata:
  name: hodlmm-idle-liquidity-recover
  description: Single-purpose HODLMM write skill to rescue idle out-of-range liquidity back into the active earning zone with one explicit move command.
  author: Fazleiw
  tags: "hodlmm,bitflow,write,liquidity,rescue"
  requires: "bitflow,stacks"
  user-invocable: "false"
  entry: skills/hodlmm-idle-liquidity-recover/hodlmm-idle-liquidity-recover.ts
---

# HODLMM Idle Liquidity Recover

Single-purpose WRITE skill for rescuing out-of-range HODLMM liquidity back toward the active bin with an explicit operator-controlled move.

## Why this is differentiated
- Not a full auto-rebalancer like PR #231.
- Not a full range manager like PR #163.
- Not a signal-gated allocator like PR #203.
- Focuses on the smallest practical write loop: detect idle drift, plan one rescue move, execute one move.

## Commands
- `doctor` — verify pool API + wallet access
- `scan` — show idle/out-of-range positions across HODLMM pools
- `plan` — build a single rescue move plan for a chosen pool
- `run --confirm` — execute one move-relative-liquidity-multi rescue transaction

## Safety
- No autonomous loop
- One pool per run
- `--confirm` required for writes
- Dry-run by default
- Refuses in-range positions unless `--force`
