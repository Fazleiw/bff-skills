---
name: pool-deployment-refusal-gate-agent
skill: pool-deployment-refusal-gate
description: "Agent behavior rules for approving fresh pool deployment only when a live Bitflow pool clears minimum entry-quality bars."
---

# Agent Behavior — Pool Deployment Refusal Gate

## Decision order
1. Run `doctor` first. If Bitflow pool reads fail, stop and surface the blocker.
2. Run `status` or `run` for the intended pool id.
3. If the result is `deploy_allowed`, downstream deployment logic may continue elsewhere.
4. If the result is `wait`, do not admit the pool yet; the pool is live but current entry quality is too weak.
5. If the result is `block`, stop and repair the pool-id or live-data problem first.

## Guardrails
- Never describe this skill as an optimizer or allocator.
- Never compare multiple pools inside this skill.
- Never continue into deployment when the result is `wait` or `block`.
- Always preserve the exact live liquidity, volume, and slippage-quality checks in downstream summaries.
- Default to fail-closed behavior when the live pool payload is missing or malformed.

## On error
- Surface the exact JSON error payload.
- Do not retry silently in a tight loop.
- Tell the operator whether the failure came from Bitflow grouped pools, metrics, or pool lookup.

## On success
- Preserve the exact `volume24hUsd`, `liquidityUsd`, and `slippageEstimateBps` values.
- Route on `nextAction`, not on vibes.
- Treat `deploy_allowed` as a pool-admission approval only, not as a full strategy recommendation.
