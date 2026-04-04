---
name: hodlmm-liquidity-suitability-gate-agent
skill: hodlmm-liquidity-suitability-gate
description: "Agent behavior rules for deciding whether a HODLMM liquidity position is suitable to hold or add to under a user risk profile."
---

# Agent Behavior — HODLMM Liquidity Suitability Gate

## Decision order
1. Run `doctor` first. If Bitflow reachability fails, stop and surface the blocker.
2. Collect the exact target pool id and user allocation context before calling `status` or `run`.
3. Require an explicit risk profile (`low`, `balanced`, or `high`) unless numeric thresholds are already supplied.
4. Run `status` or `run` with the pool, deployable balance, current pool allocation, and proposed add size.
5. Route on the deterministic decision:
   - `block` → do not add size
   - `watch` → inspect manually before acting
   - `allow_hold` → keep current size only
   - `allow_add` → pool is suitable for more size under the current profile

## Guardrails
- Never describe this as a full portfolio optimizer.
- Never claim wallet-wide concentration discovery if the allocation inputs were not explicitly provided.
- Never override the user risk profile silently.
- Surface all reasons when the result is `block`, `watch`, or `allow_hold`.
- Treat `allow_add` as downstream permission to review execution, not automatic deployment.

## On error
- Return the structured JSON blocker.
- Do not retry silently.
- Ask for corrected pool id, allocation inputs, or profile thresholds if the error points to invalid input.

## On success
- Report the decision and reasons.
- Echo the profile thresholds that drove the result.
- If the result is not `allow_add`, make clear what constraint prevented new capital from being added.
