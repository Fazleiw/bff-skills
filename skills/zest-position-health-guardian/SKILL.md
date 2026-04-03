---
name: zest-position-health-guardian
description: "Check whether a Zest lending position is operationally healthy before an agent supplies, withdraws, or reuses capital."
metadata:
  author: "griffinxbt"
  author-agent: "Inner Whale"
  user-invocable: "false"
  arguments: "doctor | status --asset <symbolOrContractId> [--address <addr>] | run --asset <symbolOrContractId> [--address <addr>] [--min-health-ratio <bps>] [--max-utilization-bps <bps>]"
  entry: "zest-position-health-guardian/zest-position-health-guardian.ts"
  requires: "wallet, signing, settings"
  tags: "defi, read-only, mainnet-only, infrastructure, l2"
---

# Zest Position Health Guardian

## What it does
Checks whether a Zest lending position is healthy enough for an agent to leave untouched, requires caution, or should block downstream capital actions. It reads live Zest position state, compares supplied vs borrowed exposure, and combines that with configurable health thresholds to return a clear `HEALTHY`, `WATCH`, or `BLOCKED` decision.

## Why agents need it
Generic yield managers tell an agent how to supply or withdraw. They do not give a narrow health gate that other strategies can call before reusing capital, levering exposure, or assuming the position is safe. This skill is the missing primitive: a fail-closed position-health decision surface for any Zest-linked agent loop.

## Safety notes
- **Read-only.** This skill never broadcasts a transaction.
- **Mainnet only.** Reads Zest Protocol state on Stacks mainnet.
- **No liquidation oracle claims.** It does not estimate liquidation price or simulate liquidation paths.
- **Conservative by design.** Missing position data or degraded health returns `WATCH` or `BLOCKED`, not false comfort.

## Commands

### doctor
Checks wallet readability, Zest asset discovery, and whether the configured/default address can be queried safely.
```bash
bun run skills/zest-position-health-guardian/zest-position-health-guardian.ts doctor
```

### status
Read-only status check for a single Zest asset position.
```bash
bun run skills/zest-position-health-guardian/zest-position-health-guardian.ts status --asset sBTC
```

### run
Core health decision. Returns a machine-routable health classification and next action.
```bash
bun run skills/zest-position-health-guardian/zest-position-health-guardian.ts run --asset sBTC --min-health-ratio 15000 --max-utilization-bps 9000
```

## Output contract
All outputs are JSON.

**Healthy:**
```json
{
  "status": "success",
  "action": "Position healthy - safe to keep current capital state",
  "data": {
    "classification": "HEALTHY",
    "asset": "sBTC",
    "supplied": "250000",
    "borrowed": "0",
    "health_ratio_bps": 99999,
    "thresholds": {
      "min_health_ratio_bps": 15000,
      "max_utilization_bps": 9000
    }
  },
  "error": null
}
```

**Watch:**
```json
{
  "status": "success",
  "action": "Watch position health - review before reusing capital",
  "data": {
    "classification": "WATCH"
  },
  "error": null
}
```

**Blocked:**
```json
{
  "status": "blocked",
  "action": "Do not assume this position is healthy for downstream capital decisions",
  "data": {
    "classification": "BLOCKED"
  },
  "error": {
    "code": "health_below_threshold",
    "message": "Position health ratio below configured minimum",
    "next": "Withdraw, repay, or reduce reuse assumptions before proceeding"
  }
}
```

## Proof
Live smoke-tested in the BFF repo context against address `SP137SY7VWJFMVBF9GMCSQ2GETC1FV5FYZVKXSMJ8`.

- `doctor` returned `success` with live STX balance and Zest probe output
- `status --asset sBTC` returned `classification: HEALTHY`
- full commands and JSON outputs are stored in `proof.md`

This is a **read-only infrastructure primitive**, so the proof standard is live deterministic output rather than a write tx hash.

## Known constraints
- Uses current Zest position reads only. It does not fetch pool-wide utilization yet.
- A pure supply-only position with zero borrow will normally classify as `HEALTHY` unless read failures occur.
- If Zest read surfaces change upstream, this skill fails closed.
- This primitive is strongest when composed with other Zest or treasury automation skills.
