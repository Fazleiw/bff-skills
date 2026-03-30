---
name: borrow-buffer-gate
description: "Fail-closed borrow safety primitive that determines whether a collateralized borrowing position still has a healthy safety buffer, a thinning buffer, or an unacceptable liquidation cushion."
metadata:
  author: "Fazleiw"
  author-agent: "Inner Whale"
  user-invocable: "false"
  arguments: "doctor | run --wallet <address> [--safe-hf <number>] [--critical-hf <number>]"
  entry: "borrow-buffer-gate/borrow-buffer-gate.ts"
  requires: ""
  tags: "defi, read-only, mainnet-only, lending"
---

# Borrow Buffer Gate

## What it does
`borrow-buffer-gate` is a fail-closed borrowing safety primitive. It answers one narrow operational question: **does this borrow position still have a healthy safety buffer, a thinning buffer, or an unacceptable liquidation cushion?**

It reads a wallet's borrowing state, compares the live health factor against explicit thresholds, and emits one of four deterministic outcomes:
- `safe`
- `thin_buffer`
- `top_up_soon`
- `unacceptable`

## Why this is useful
This is not a dashboard, portfolio tracker, or generic lending monitor.
- it does not optimize strategy
- it does not execute transactions
- it does not guess what the user should do across all protocols

It answers one exact risk question that downstream agents can chain on top of before refinancing, topping up, reducing exposure, or staying idle.

## Commands

### doctor
Checks whether required read paths are reachable.

```bash
bun run skills/borrow-buffer-gate/borrow-buffer-gate.ts doctor
```

### run
Scores the wallet's borrow safety buffer.

```bash
bun run skills/borrow-buffer-gate/borrow-buffer-gate.ts run --wallet SP000000000000000000002Q6VF78
```

Optional thresholds:
- `--safe-hf` default: `1.5`
- `--critical-hf` default: `1.15`

## Output contract
All commands output JSON to stdout.

### doctor
```json
{
  "status": "success",
  "action": "doctor",
  "data": {
    "checks": {
      "hiro_api": "ok",
      "borrow_read_path": "ok"
    },
    "ready": true
  },
  "error": null
}
```

### run
```json
{
  "status": "success",
  "action": "thin_buffer",
  "data": {
    "wallet": "SP000000000000000000002Q6VF78",
    "protocol": "borrow",
    "healthFactor": 1.31,
    "safeThreshold": 1.5,
    "criticalThreshold": 1.15,
    "bufferBand": "thinning",
    "reasons": [
      "health_factor_below_safe_threshold"
    ]
  },
  "error": null
}
```

## Decision logic
- `safe` → `healthFactor >= safeThreshold`
- `thin_buffer` → `criticalThreshold + 0.1 <= healthFactor < safeThreshold`
- `top_up_soon` → `criticalThreshold <= healthFactor < criticalThreshold + 0.1`
- `unacceptable` → `healthFactor < criticalThreshold`

If critical data is missing, the skill fails closed with `error` rather than inventing safety.

## Safety notes
- Read-only
- No transactions submitted
- No capital movement
- Mainnet-oriented read paths only
- Missing or invalid borrow state yields fail-closed output
