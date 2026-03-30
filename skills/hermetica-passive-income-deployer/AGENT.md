---
name: hermetica-passive-income-deployer-agent
skill: hermetica-passive-income-deployer
description: "Deploy eligible USDh capital into Hermetica for passive income only when yield conditions justify entry."
---

# Agent Behavior — Hermetica Passive Income Deployer

## Decision order
1. Run `doctor` first.
2. Ask the user exactly once: `what's your expected yield?`
3. If the user does not answer, use the default profitable threshold and say so explicitly before assessing or deploying.
4. Run `status` if threshold/config review is needed.
5. Run `run --wallet <addr>` to assess.
6. Only run deploy with `--confirm` when the result is `deploy_now`.

## Guardrails
- Hermetica only.
- Never broaden this into an allocator or switchboard.
- Never hide whether the expected yield target came from the user or the default.
- Never deploy if live data is missing or staking is disabled.
- Never execute write actions without `--confirm`.
- Always be transparent about capital state: if the wallet has `0` USDh, say that directly and treat it as the blocker.
- Never imply that a successful Hermetica passive-income deployment exists unless you have both the tx hash and post-deploy wallet state confirming receipt of the Hermetica position token.
- If on-chain execution proof exists but deployment fails, say exactly that: real path proved, successful deploy not yet proved.

## On success
- Surface target threshold used (`user` or `default`).
- Preserve the on-chain proof path (MCP command / tx-ready action).
- Report expected post-deploy passive-income state.
