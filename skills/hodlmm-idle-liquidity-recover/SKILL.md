---
name: hodlmm-idle-liquidity-recover
description: "Single-purpose HODLMM write skill to recover idle liquidity using one explicit move-relative-liquidity-multi transaction"
metadata:
  author: "Fazleiw"
  author-agent: "Twin Cyrus"
  user-invocable: "false"
  arguments: "doctor | scan | run | auto"
  entry: "hodlmm-idle-liquidity-recover/hodlmm-idle-liquidity-recover.ts"
  requires: "wallet, signing"
  tags: "defi, write, l2, mainnet-only, requires-funds"
---

# HODLMM Idle Liquidity Recover

## What it does
Detects out-of-range HODLMM liquidity and (optionally) executes one atomic on-chain recovery move via `move-relative-liquidity-multi`.

## Why agents need it
This is a narrow write primitive: one pool, one rescue plan, one transaction. It avoids “full position manager” complexity while still letting an operator/agent recover idle liquidity that has stopped earning.

## Safety notes
- Dry-run by default; broadcasts only with `--confirm`.
- One pool per run.
- Refuses broadcast if STX balance < 1.0 (gas floor).
- 4-hour cooldown per pool (persisted state).

Important post-conditions note:
- The transaction uses `PostConditionMode.Allow` with `postConditions: []`.
- Rationale: DLP burn + mint happens inside one router tx and cannot be expressed as simple sender-side post-conditions.
- Mitigation: per-move slippage bounds in args (`min-dlp` >= 95%; `max-x/y-liquidity-fee` <= 5%) + strict plan construction + `--confirm` gate.

## Commands
- `doctor --wallet <STX>`
- `scan --wallet <STX>`
- `run --wallet <STX> --pool <id> --spread <n> [--force]` (dry-run)
- `run --wallet <STX> --pool <id> --spread <n> --confirm --password <pass> [--force]` (broadcast)
- `auto --wallet <STX> --password <pass> [--interval <m>] [--drift-threshold <bins>] [--spread <n>] [--max-moves <n>] [--once]`

## Example commands
```bash
bun run skills/hodlmm-idle-liquidity-recover/hodlmm-idle-liquidity-recover.ts doctor --wallet <STX_ADDRESS>
bun run skills/hodlmm-idle-liquidity-recover/hodlmm-idle-liquidity-recover.ts scan --wallet <STX_ADDRESS>

# Dry-run (safe)
bun run skills/hodlmm-idle-liquidity-recover/hodlmm-idle-liquidity-recover.ts run --wallet <STX_ADDRESS> --pool dlmm_3 --spread 1

# Mainnet write (dangerous; requires gas + explicit confirmation)
bun run skills/hodlmm-idle-liquidity-recover/hodlmm-idle-liquidity-recover.ts run --wallet <STX_ADDRESS> --pool dlmm_3 --spread 1 --force --confirm --password <redacted>
```

## Output contract
All outputs are JSON to stdout.

Registry-minimum error:
```json
{ "error": "descriptive message" }
```

Success envelope (used by this skill):
```json
{ "status": "success|degraded|blocked", "action": "doctor|scan|run|auto", "data": { } }
```

Example (run executed):
```json
{ "status": "success", "action": "run", "data": { "decision": "EXECUTED", "transaction": { "txid": "<txid>", "explorer": "https://explorer.hiro.so/txid/<txid>?chain=mainnet" } } }
```

## Proof
This is a write skill: reviewers require a mainnet transaction link (Hiro Explorer or mempool.space) showing a successful `move-relative-liquidity-multi` execution.
