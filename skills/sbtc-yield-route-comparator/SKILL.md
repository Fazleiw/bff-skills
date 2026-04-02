---
name: sbtc-yield-route-comparator
description: "Compare live sBTC deployment routes across Bitflow, Zest, and Hermetica, then return a single fail-closed capital routing decision for agents."
metadata:
  author: "Fazleiw"
  author-agent: "Inner Whale"
  user-invocable: "false"
  arguments: "doctor | status | run --amount <number> [--min-edge-bps <number>] [--max-risk <low|medium>]"
  entry: "sbtc-yield-route-comparator/sbtc-yield-route-comparator.ts"
  requires: "wallet, settings"
  tags: "defi, sbtc, bitflow, zest, hermetica, yield, comparator"
---

# sbtc-yield-route-comparator

## What it does

`sbtc-yield-route-comparator` compares a small set of sBTC deployment routes and returns one operational decision:

- `rotate`
- `stay`
- `wait`
- `block`

The goal is not to rank protocols abstractly. The goal is to answer one capital-routing question for agents:

**where should this sBTC sit right now, if anywhere, based on visible yield and route confidence?**

## Current route set

- **Bitflow** — live-eligible route checked against Bitflow APY surface when reachable and when an sBTC path is visible
- **Zest** — strategic route placeholder until a reviewed public APY surface is available
- **Hermetica** — live quoted route from the public Hermetica landing page when visible
- **stay-in-wallet** — zero-deployment baseline

## Why agents need it

This is a routing primitive for yield agents, treasury agents, and portfolio managers.

Instead of giving a broad dashboard, it produces a single reusable decision surface that downstream agents can chain into:

- yield rotation flows
- treasury allocation checks
- "move or wait" guards
- pre-deployment review steps

## Decision logic

The skill:

1. fetches live route signals from public Bitflow and Hermetica surfaces when available
2. assigns explicit confidence and risk labels to every route
3. compares projected APY edge versus a stay baseline
4. refuses to recommend capital movement when data confidence is weak or edge is too small
5. emits one best route and ranked alternatives as strict JSON

## Output contract

Success envelope:

```json
{
  "status": "success",
  "action": "rotate",
  "data": {
    "decision": {
      "route": "bitflow",
      "reason": "bitflow clears minimum edge and confidence thresholds"
    },
    "bestRoute": {},
    "alternatives": []
  },
  "error": null
}
```

Minimum error contract:

```json
{
  "error": "descriptive message"
}
```

## Safety notes

- Read-only v1: does not move funds
- Fail-closed: weak or missing route data returns `wait` or `block`
- Conservative defaults: non-verified routes are penalized with lower confidence
- `rotate` requires both edge and confidence to clear thresholds

## Commands

### doctor

Checks whether the Bitflow route source is reachable and returns route inventory.

### status

Alias of `doctor` with the same read-only diagnostics.

### run

Compares available routes and emits the routing decision.

Arguments:

- `--amount <number>` simulated sBTC amount for reasoning context
- `--min-edge-bps <number>` minimum APY edge over baseline required for `rotate` (default: `150`)
- `--max-risk <low|medium>` maximum acceptable route risk (default: `medium`)

## Example use

- compare sBTC routes before reallocating treasury
- decide whether current market conditions justify moving sBTC into Bitflow
- block low-conviction reallocations during thin yield edge conditions
