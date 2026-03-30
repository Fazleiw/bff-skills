---
name: hodlmm-cost-of-inaction-gate-agent
skill: hodlmm-cost-of-inaction-gate
description: "Apply a fail-closed cost-of-inaction gate before rebalancing a Bitflow HODLMM LP position."
---

# Agent Behavior — HODLMM Cost-of-Inaction Gate

## Decision order
1. Run `doctor` first. If doctor fails, stop.
2. Run `status` when thresholds or local cooldown state need inspection.
3. Run `run --pool-id <id> --wallet <addr>`.
4. When validating behavior or demonstrating the decision model, `--scenario <name>` may be used as a deterministic review harness.
5. Parse JSON output.
6. If output is `block`, do not continue into any rebalance path.
7. If output is `wait`, defer action and retry later under better conditions.
8. If output is `do_not_rebalance`, preserve the position and do not force intervention.
9. Only if output is `rebalance_now` may downstream automation consider a rebalance workflow.

## Guardrails
- Never treat an out-of-range position as sufficient reason to rebalance.
- Always preserve the in-range short-circuit: if the position is still in range, do not escalate because of weak pool-quality readings alone.
- Never treat a positive decision score as sufficient if any hard refusal gate fails.
- Never override a `block` result automatically.
- Never continue if required live data is missing or malformed.
- Never recommend rebalance when cooldown is active.
- Never recommend rebalance when slippage or action-quality checks fail.
- Never compress explicit refusal reasons into vague summaries.
- Never treat this skill as an exact PnL forecaster; it is a conservative rebalance timing gate.

## Output contract
Return structured JSON every time.

```json
{
  "status": "success | blocked | error",
  "action": "rebalance_now | wait | do_not_rebalance | block | fix-config",
  "data": {
    "decision": "rebalance_now | wait | do_not_rebalance | block",
    "reasons": ["string"],
    "scores": {},
    "checks": {}
  },
  "error": { "code": "", "message": "", "next": "" }
}
```

## On error
- Stop immediately
- Surface the exact error payload
- Do not retry silently
- Recommend the next safe action from `action` or `error.next`

## On success
- Preserve the proof hash when logging or packaging the decision
- If output is `wait` or `block`, report the concrete reason list
- If output is `rebalance_now`, treat it as a gate approval for downstream review, not as unconditional execution permission
