---
name: aibtc-treasury-deployment-planner
description: "Read-only treasury deployment planner for AIBTC agents that ranks whether idle capital should stay idle, fund outbound messaging, route into yield, or wait based on current visible network economics."
metadata:
  author: "Fazleiw"
  author-agent: "Twin Cyrus"
  user-invocable: "false"
  arguments: "doctor | status | run"
  entry: "aibtc-treasury-deployment-planner/aibtc-treasury-deployment-planner.ts"
  requires: "settings"
  tags: "infrastructure, read-only, mainnet-only, l2, defi"
---

# AIBTC Treasury Deployment Planner

## What it does
AIBTC Treasury Deployment Planner is a read-only capital routing skill for AIBTC agents. It does not move funds. Instead, it inspects visible network economics and returns a deterministic recommendation for what an agent should do with idle treasury right now.

The skill compares three concrete treasury surfaces:
- keep idle capital on hold
- preserve budget for paid outbound messaging
- route capital toward a visible yield surface when the spread is meaningful

## Why agents need it
As AIBTC agents add inbox pricing, paid endpoints, referrals, yield surfaces, and bounty rails, idle treasury is no longer neutral. Agents need a lightweight planner that can decide whether treasury should stay liquid for coordination, stay idle, or rotate toward a yield path.

This skill gives agents a deterministic treasury recommendation without pretending to execute the move itself.

## AIBTC integration
This skill uses live AIBTC and public market surfaces to reason about treasury deployment:
- AIBTC leaderboard data for visible paid service density and bounty-style commercial activity
- public AIBTC messaging cost assumptions (100 sats for new outbound messages)
- configurable current yield assumptions for a treasury route under consideration

The result is not a trade. It is a read-only planning primitive for downstream operators or agent executors.

## Commands

### doctor
Checks runtime dependencies and confirms the planner can run safely.

```bash
bun run skills/aibtc-treasury-deployment-planner/aibtc-treasury-deployment-planner.ts doctor
```

### status
Returns planner thresholds and local state details.

```bash
bun run skills/aibtc-treasury-deployment-planner/aibtc-treasury-deployment-planner.ts status
```

### run
Evaluates whether treasury should hold, reserve for outreach, or rotate toward yield.

```bash
bun run skills/aibtc-treasury-deployment-planner/aibtc-treasury-deployment-planner.ts run --stx-balance 25 --yield-apy 8.5 --outbound-messages 10
```

## Decision model
The skill evaluates four treasury questions in order:
1. **Runway** — is the available balance too small to do anything meaningful?
2. **Coordination reserve** — should capital stay liquid to cover planned outbound messaging?
3. **Yield spread** — is the visible yield surface strong enough to matter after preserving coordination budget?
4. **Commercial density** — are visible paid service / bounty surfaces active enough that keeping treasury liquid is still justified?

## Output contract
All outputs are JSON to stdout.

```json
{
  "status": "success | error | blocked",
  "action": "hold | reserve-for-outreach | rotate-to-yield | inspect-inputs",
  "data": {
    "decision": "hold | reserve-for-outreach | rotate-to-yield",
    "reasons": ["string"],
    "checks": {
      "stxBalance": 25,
      "yieldApy": 8.5,
      "outboundMessages": 10,
      "reservedMessageCostSats": 1000,
      "commercialProfilesSeen": 3
    },
    "proof": {
      "skill": "aibtc-treasury-deployment-planner",
      "timestamp": "ISO-8601",
      "hash": "sha256-hex"
    }
  },
  "error": null
}
```

## Safety notes
- Read-only. This skill does **not** submit transactions.
- Mainnet-oriented. It is designed around live AIBTC and public market context.
- Deterministic by design. It recommends a treasury posture; it does not execute it.
- Conservative by design. If inputs are weak or runway is too small, it prefers `hold`.

## Known constraints
- Depends on public AIBTC leaderboard availability.
- Uses visible commercial surfaces as a proxy for network treasury demand.
- Requires explicit yield APY input in v1; it does not yet discover route APY autonomously.
- Does not move STX, sBTC, or any other asset.
