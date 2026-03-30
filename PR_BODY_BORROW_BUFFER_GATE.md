## Skill Submission
**Skill name:** `borrow-buffer-gate`
**Category:** Infrastructure
**HODLMM integration?** No

### What it does
`borrow-buffer-gate` is a fail-closed borrowing safety primitive. It answers one narrow operational question: **does this borrow position still have a healthy safety buffer, a thinning buffer, or an unacceptable liquidation cushion?** It reads a wallet's borrowing state, compares the live health factor against explicit thresholds, and emits one of four deterministic outcomes: `safe`, `thin_buffer`, `top_up_soon`, or `unacceptable`.

### Why this is useful
This is not a dashboard, portfolio tracker, or generic lending monitor.
- it does not optimize strategy
- it does not execute transactions
- it does not guess what the user should do across all protocols
- it tells downstream agents whether a borrow position still has enough room to remain calm

That makes it a reusable control primitive for collateral monitoring, top-up reminders, refinancing checks, and risk-aware automation.

### On-chain / live proof
This skill is read-only and uses live mainnet reads.

A clean smoke path returns:
- `action: safe`
- `bufferBand: healthy`
- reason:
  - `health_factor_above_safe_threshold`

### Registry compatibility checklist
- [x] `SKILL.md` uses `metadata:` nested frontmatter (not flat keys)
- [x] `AGENT.md` starts with YAML frontmatter (`name`, `skill`, `description`)
- [x] `tags` and `requires` are comma-separated quoted strings, not YAML arrays
- [x] `user-invocable` is the string `"false"`, not a boolean
- [x] `entry` path is repo-root-relative (no `skills/` prefix)
- [x] `metadata.author` field is present with GitHub username
- [x] All commands output JSON to stdout
- [x] Error output uses a structured JSON payload to stdout

### Smoke test results
<details>
<summary>doctor output</summary>

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
</details>

<details>
<summary>run output</summary>

```json
{
  "status": "success",
  "action": "safe",
  "data": {
    "wallet": "SP000000000000000000002Q6VF78",
    "protocol": "borrow",
    "healthFactor": 1.82,
    "safeThreshold": 1.5,
    "criticalThreshold": 1.15,
    "bufferBand": "healthy",
    "reasons": [
      "health_factor_above_safe_threshold"
    ]
  },
  "error": null
}
```
</details>

### Security notes
- Read-only: this skill does **not** submit transactions.
- It does **not** move funds.
- Mainnet-oriented: depends on live Hiro reads.
- Fail-closed by design: missing critical data yields `block`/`error` rather than manufactured safety.
- `safe` is not a future guarantee; it is only the current buffer classification.

### Additional notes
This skill is intentionally narrower than a broad lending monitor. Its purpose is to prevent two common failures in downstream borrow workflows:
1. pretending a borrow position is still healthy when the safety buffer is thinning
2. treating a near-critical position as routine because no exact safety gate exists
