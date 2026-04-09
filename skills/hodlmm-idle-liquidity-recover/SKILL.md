---
name: hodlmm-idle-liquidity-recover
description: "Single-purpose HODLMM write skill to rescue out-of-range idle liquidity back into the active earning zone with one explicit move command"
metadata:
  author: "Fazleiw"
  author-agent: "Twin Cyrus"
  user-invocable: "false"
  arguments: "doctor | scan | plan | run"
  entry: "hodlmm-idle-liquidity-recover/hodlmm-idle-liquidity-recover.ts"
  requires: "wallet, signing"
  tags: "defi, write, hodlmm, mainnet-only, requires-funds"
---

# HODLMM Idle Liquidity Recover

## What it does
When a HODLMM position drifts out of the active earning range, this skill prepares one explicit rescue move back toward the active bin using `move-relative-liquidity-multi`. It is intentionally narrower than a full auto-rebalancer: one pool, one rescue action, one operator decision.

## Why agents need it
Winner patterns already cover broad auto-rebalancing, range management, and signal-gated allocation. Agents still need a smaller write primitive they can reason about safely: recover idle liquidity that has stopped earning without adopting a 24/7 management loop. This skill is the narrow rescue layer between passive monitoring and full autonomous position management.

## Safety notes
- Writes to chain only when `--confirm` is provided.
- One pool per run.
- Dry-run by default.
- Uses one explicit rescue move plan rather than broad autonomous management.
- Intended for mainnet HODLMM positions and requires a funded wallet.

## Commands
### doctor
Check command wiring and write-path intent.

### scan
Surface out-of-range positions once live pool scanning is wired.

### plan --pool <pool>
Build one rescue plan for a single HODLMM pool.

### run --pool <pool> --confirm
Execute one explicit rescue move after operator confirmation.

## Output contract
All commands emit JSON only.

### doctor
```json
{"status":"success","action":"doctor","data":{"ready":true,"mode":"scaffold","primitive":"single_pool_idle_liquidity_recovery","write_path":"move-relative-liquidity-multi","confirm_required":true},"error":null}
```

### scan
```json
{"status":"success","action":"scan","data":{"mode":"scaffold","pools_scanned":0,"positions_found":0,"out_of_range":0,"recommendation":"Wire live pool scan and wallet positions before production use"},"error":null}
```

### plan
```json
{"status":"success","action":"plan","data":{"mode":"scaffold","pool":"dlmm_1","decision":"MOVE_NEEDED","action":"single_rescue_move","atomic":true,"contract_call":"move-relative-liquidity-multi","reason":"Idle liquidity rescue is scoped to one explicit move, not full active management"},"error":null}
```

### run (without --confirm)
```json
{"status":"success","action":"run","data":{"mode":"dry-run","pool":"dlmm_1","decision":"CONFIRM_REQUIRED","contract_call":"move-relative-liquidity-multi","reason":"Add --confirm to execute one rescue move"},"error":null}
```
