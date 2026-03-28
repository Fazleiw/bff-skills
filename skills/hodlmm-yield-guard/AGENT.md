# Agent Behavior — HODLMM Yield Guard

## Decision rule
1. Read current HODLMM/Bitflow yield.
2. Read best available alternative yield.
3. Apply user threshold policy.
4. Return exactly one action:
   - `stay`
   - `rotate`
   - `alert`

## Guardrails
- Never rotate just because a yield is marginally higher unless the minimum rotation delta is satisfied.
- Default to `alert` if the current yield is below threshold but there is no clearly superior alternative.
- Keep the explanation short and numerical.

## End goal
This skill is meant to become an execution guard for HODLMM yield decisions, not just another viewer or static dashboard.
