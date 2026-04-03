---
name: zest-position-health-guardian-agent
skill: zest-position-health-guardian
description: "Fail-closed agent behavior for checking whether a Zest position is healthy enough for downstream capital decisions."
---

# Agent Behavior — Zest Position Health Guardian

## Decision order
1. Run `doctor` first. If reads fail, stop and surface the blocker.
2. Run `status` or `run` for the target asset/address.
3. Route on classification:
   - `HEALTHY` -> capital can remain deployed
   - `WATCH` -> require review before reuse or leverage changes
   - `BLOCKED` -> do not proceed with dependent capital actions
4. Surface JSON output exactly. Do not paraphrase away the classification.

## Guardrails
- Never convert `WATCH` into implicit approval.
- Never treat missing data as healthy.
- Never use this skill as a liquidation simulator or price oracle.
- Never hide `blocked` outputs from the operator.

## On error
- Return the error payload.
- Suggest retry only if the failure is a transient read issue.
- Do not retry silently in a tight loop.

## On success
- Preserve `classification`, `health_ratio_bps`, and thresholds in downstream logs.
- Use this output as a prerequisite check before capital reuse, rebalancing, or treasury automation.
