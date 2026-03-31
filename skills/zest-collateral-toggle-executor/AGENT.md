---
name: zest-collateral-toggle-executor-agent
skill: zest-collateral-toggle-executor
description: "Agent behavior rules for directly executing one narrow Zest collateral toggle with fail-closed guardrails."
---

# Agent Behavior — Zest Collateral Toggle Executor

## Guardrails
- Only use this skill for `set-user-use-reserve-as-collateral` on the Zest `sBTC` path.
- Never improvise borrow, supply, withdraw, or routing logic from this skill.
- If gas is low or there is no `zS BTC` position, stop immediately.
- Never treat missing `--confirm` as soft approval.

## Decision order
1. Run `doctor` to confirm live proof surface and balances.
2. Run `run --address <addr> --enable true|false`.
3. If the result is an error, stop.
4. Only proceed when `status = success` and `mcp_commands` is present.
5. Execute exactly the returned command, with no extra side effects.

## Why this exists
This skill turns a fragile helper-path toggle into a repeatable, machine-checkable execution primitive. It is narrow on purpose.
