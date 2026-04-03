## Skill Submission

Skill name: zest-position-health-guardian

Category: Infrastructure

HODLMM integration? No

### What it does

zest-position-health-guardian is a fail-closed read-only Zest decision primitive for lending-aware agents. It answers one narrow operational question: is this Zest position healthy enough to be treated as safe for downstream capital decisions right now?

It reads live Zest reserve state for a wallet + asset pair and emits one of three deterministic classifications:

- HEALTHY
- WATCH
- BLOCKED

### Why this is useful

This is not a dashboard, generic monitor, or broad yield manager.

- zest-yield-manager handles supply / withdraw / claim workflows
- sbtc-auto-funnel handles idle sBTC deployment into Zest
- zest-position-health-guardian is narrower: it provides a reusable health gate that other treasury, lending, or capital-routing agents can call before assuming a deployed position is safe to ignore or reuse around

That makes it a composable infrastructure primitive instead of another broad manager.

### On-chain / live proof

This skill is read-only, so the proof standard is live deterministic output rather than a broadcast tx hash.

Smoke-tested in repo context against:
- `SP137SY7VWJFMVBF9GMCSQ2GETC1FV5FYZVKXSMJ8`

Observed positive smoke path:
- `doctor` returned success
- `status --asset sBTC` returned `classification: HEALTHY`

### Registry compatibility checklist

- SKILL.md uses metadata: nested frontmatter (not flat keys)
- AGENT.md starts with YAML frontmatter (name, skill, description)
- tags and requires are comma-separated quoted strings, not YAML arrays
- user-invocable is the string "false", not a boolean
- entry path is repo-root-relative (no skills/ prefix)
- metadata.author field is present with GitHub username
- All commands output JSON to stdout
- Error output uses a structured JSON payload to stdout

### Smoke test results

doctor output
```json
{
  "status": "success",
  "action": "Ready to read Zest position health",
  "data": {
    "address": "SP137SY7VWJFMVBF9GMCSQ2GETC1FV5FYZVKXSMJ8",
    "stx_ustx": 3032189,
    "probe_position": {
      "supplied": 0,
      "borrowed": 0
    }
  },
  "error": null
}
```

status output
```json
{
  "status": "success",
  "action": "Position healthy - safe to keep current capital state",
  "data": {
    "classification": "HEALTHY",
    "address": "SP137SY7VWJFMVBF9GMCSQ2GETC1FV5FYZVKXSMJ8",
    "asset": "sBTC",
    "supplied": "0",
    "borrowed": "0",
    "health_ratio_bps": 99999,
    "thresholds": {
      "min_health_ratio_bps": 15000,
      "max_utilization_bps": 9000
    },
    "raw_position": null
  },
  "error": null
}
```

### Security notes

- Read-only: this skill does not submit transactions.
- It does not move funds.
- Mainnet-oriented: depends on live Hiro + Zest read surfaces.
- Fail-closed by design: missing or degraded reads should never manufacture a healthy classification.
- HEALTHY is a gate output for downstream use, not proof that every broader capital decision is safe.

### Additional notes

This skill is intentionally primitive and narrow.

Its job is to reduce one specific failure mode in downstream Zest workflows:
- treating a lending position as operationally safe without an explicit health gate

That narrowness is the point.
