---
name: hodlmm-idle-liquidity-recover
description: "Single-purpose HODLMM write skill to rescue out-of-range idle liquidity back into the active earning zone with one explicit move command"
metadata:
  author: Fazleiw
  tags: "hodlmm,bitflow,write,liquidity,rescue"
  requires: "bitflow,stacks"
  user-invocable: "false"
  entry: hodlmm-idle-liquidity-recover/hodlmm-idle-liquidity-recover.ts
---

# HODLMM Idle Liquidity Recover

## What it does
Single-purpose WRITE skill for rescuing out-of-range HODLMM liquidity back toward the active earning zone with one explicit move command. It narrows the scope to one operator-controlled recovery action instead of full autonomous portfolio management.

## Why agents need it
Existing winner patterns already cover broad auto-rebalancing, range management, and signal-gated allocation. This skill targets a smaller operational gap: a safe, explicit rescue move for idle liquidity that is no longer earning because the active bin drifted away. Agents need a narrow write primitive they can reason about, test, and confirm without adopting a full management loop.

## Commands
- `doctor` — verify HODLMM API and wallet access
- `scan` — find idle or out-of-range positions
- `plan --pool <pool>` — prepare a single rescue move
- `run --pool <pool> --confirm` — execute one rescue transaction

## Safety notes
- No autonomous loop
- One pool per run
- `--confirm` required for writes
- Dry-run default
- Refuses in-range positions unless explicitly forced in a future implementation

## Output contract
All commands emit JSON only.

### doctor
```json
{"status":"success","action":"doctor","data":{"ready":true,"mode":"scaffold","primitive":"single_pool_idle_liquidity_recovery"},"error":null}
```

### scan
```json
{"status":"success","action":"scan","data":{"mode":"scaffold","positions_found":0,"recommendation":"Implement live pool scan before production use"},"error":null}
```

### plan
```json
{"status":"success","action":"plan","data":{"mode":"scaffold","pool":"dlmm_1","action":"single_rescue_move","atomic":true,"contract_call":"move-relative-liquidity-multi"},"error":null}
```

### run (without --confirm)
```json
{"status":"success","action":"run","data":{"mode":"dry-run","pool":"dlmm_1","decision":"CONFIRM_REQUIRED","contract_call":"move-relative-liquidity-multi"},"error":null}
```
