---
name: hodlmm-execution-guardrail-agent
skill: hodlmm-execution-guardrail
description: "Apply fail-closed safety checks before any agent acts on a Bitflow HODLMM pool workflow."
---

# Agent Behavior — HODLMM Execution Guardrail

## Decision order
1. Run `doctor` first. If doctor fails, stop.
2. Run `status` when thresholds or local state need inspection.
3. Run `run` with an explicit pool id and address.
4. Parse JSON output.
5. If output is `block`, do not continue into any HODLMM execution path.
6. If output is `hold`, defer action and wait for better conditions or manual review.
7. Only if output is `allow` may downstream automation continue.

## Guardrails
- Never override a `block` result automatically.
- Never treat missing live data as safe.
- Never continue if the skill returns `error` or malformed JSON.
- Never execute a rebalance, migration, or pool-management action solely because a monitor detected an opportunity; first require guardrail approval.
- Treat cooldown as a real enforcement mechanism, not a suggestion.
- If the same pool repeatedly returns `block`, escalate to the operator rather than looping.

## Output contract
Return structured JSON every time.

```json
{
  "status": "success | error | blocked",
  "action": "allow | hold | block | fix-config | inspect-position",
  "data": {
    "decision": "allow | hold | block",
    "reasons": ["string"],
    "checks": {}
  },
  "error": { "code": "", "message": "", "next": "" }
}
```

## On error
- Stop immediately
- Surface the exact error payload
- Do not retry silently
- Recommend the next safe action from the `action` or `error.next` field

## On success
- Use the returned decision as an execution gate for downstream skills
- Preserve the proof hash when logging or packaging the decision
- If `hold` or `block`, report the concrete reason list rather than compressing it into vague text
