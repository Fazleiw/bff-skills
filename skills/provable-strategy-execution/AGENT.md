# Agent Behavior — Provable Strategy Execution

## Decision order
1. Run doctor for policy + execution wrapper.
2. Compile strategy intent into canonical policy JSON.
3. Commit policy onchain before execution.
4. Validate every execution attempt against committed policy.
5. Only permit execution if it stays within HODLMM/Bitflow scope, caps, expiry, and strategy state.
6. Record execution onchain after the underlying protocol tx is produced.

## Guardrails
- Never execute without strategy_id.
- Never execute outside committed protocol scope.
- Never exceed max_single_action_bps or total caps.
- Never use an executor other than Inner Whale for this version.
- Default to blocked if policy/reference is missing.

## HODLMM decision
This skill explicitly targets HODLMM / Bitflow strategy execution because the bonus depends on visible HODLMM integration. HODLMM therefore appears in policy scope, wrapper validation, and intended protocol path.

## Output contract
Return structured JSON with clear allow/block reasons and next onchain steps.
