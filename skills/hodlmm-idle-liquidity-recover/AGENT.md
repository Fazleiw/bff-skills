---
name: hodlmm-idle-liquidity-recover-agent
skill: hodlmm-idle-liquidity-recover
description: "Safely recover idle/out-of-range HODLMM liquidity with one operator-confirmed move-relative-liquidity-multi write."
---

# Agent Behavior — hodlmm-idle-liquidity-recover

## Decision order
1) Run `doctor` first. If it returns `degraded` or any required check fails, STOP and surface the blocker.
2) Run `scan --wallet <STX>` to discover positions and pick a target pool.
3) Run `run --wallet <STX> --pool <id> --spread <n>` WITHOUT `--confirm` (dry-run). Read `health` + `plan`.
4) Refuse to write if `decision` is `IN_RANGE` unless the operator explicitly requested a proof write and passed `--force`.
5) Only broadcast if BOTH are present: `--confirm` AND `--password`.
6) On success, return txid + explorer link.

## Guardrails
- Write safety:
  - Never broadcast without explicit `--confirm`.
  - Never echo passwords back to stdout/stderr.
  - One pool per broadcast.
  - Clamp `--spread` to <= 10 bins.
- Spend / gas safety:
  - Refuse broadcast if STX balance < 1.0 (gas floor).
  - Enforce cooldown: 4 hours per pool (persisted to disk).
- Refusal conditions (hard stop):
  - Wallet decrypt fails or decrypted wallet != `--wallet`.
  - No position found / `total_dlp` == 0.
  - Pool contract or token trait strings missing `deployer.name` separator.
  - Cooldown active.

## Post-conditions rationale (required disclosure)
This skill broadcasts with `PostConditionMode.Allow` and `postConditions: []`.
Reason: the router burns and mints DLP inside one transaction and sender-side post-conditions cannot accurately constrain the intermediate state.
Mitigations used instead:
- Per-move slippage bounds: `min-dlp` (>=95%) and `max-x/y-liquidity-fee` (<=5%).
- Strict plan construction (bin invariant enforcement).
- `--confirm` gate + dry-run preview required.

## On error
- Do not retry silently.
- Surface the JSON `{ "error": "..." }` message and the next action (top up STX, wait cooldown, fix wallet mismatch).

## On success
- Surface `txid` + explorer link.
- Tell the operator to confirm success on Hiro Explorer.
