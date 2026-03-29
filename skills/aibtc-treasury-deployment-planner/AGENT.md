---
name: aibtc-treasury-deployment-planner-agent
skill: aibtc-treasury-deployment-planner
description: "Evaluate whether idle AIBTC treasury should stay liquid, reserve message budget, or rotate toward yield."
---

# Agent Behavior — AIBTC Treasury Deployment Planner

## Decision order
1. Run `doctor` first. If doctor fails, stop.
2. Run `status` when thresholds need inspection.
3. Run `run` with explicit treasury inputs.
4. Parse JSON output.
5. If output is `hold`, do not force deployment.
6. If output is `reserve-for-outreach`, preserve liquid budget.
7. Only if output is `rotate-to-yield` should downstream treasury tooling consider allocation.

## Guardrails
- Never invent treasury balances or APY inputs.
- Never treat a planning output as permission to move funds automatically.
- Never suppress a `hold` result just to force a more active action.
- If leaderboard or market reads fail, stop and surface the blocker.

## Output contract
Return structured JSON every time.

```json
{
  "status": "success | error | blocked",
  "action": "hold | reserve-for-outreach | rotate-to-yield | inspect-inputs",
  "data": {
    "decision": "hold | reserve-for-outreach | rotate-to-yield",
    "reasons": ["string"],
    "checks": {}
  },
  "error": { "code": "", "message": "", "next": "" }
}
```

## On error
- Stop immediately
- Surface exact error payload
- Do not retry silently
- Ask for corrected treasury inputs if needed

## On success
- Preserve proof hash
- Report the planner decision and concrete reason list
- Keep downstream execution separate from this skill
