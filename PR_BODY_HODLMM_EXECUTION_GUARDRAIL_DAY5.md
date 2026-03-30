## Skill Submission
**Skill name:** `hodlmm-execution-guardrail`
**Category:** Infrastructure
**HODLMM integration?** Yes

### What it does
`hodlmm-execution-guardrail` is a read-only infrastructure primitive for Bitflow HODLMM workflows. It is not a strategy engine and does not place trades. Instead, it acts as a fail-closed control layer that other agents can call before entering any HODLMM action path.

The skill evaluates live Bitflow pool context and returns a deterministic decision:
- `allow`
- `hold`
- `block`

In v1, the guardrail is intentionally narrow and conservative. It checks:
- live APY availability for the target HODLMM pool
- APY drawdown from the pool's recent max APY context
- local cooldown state to prevent repeated noisy action attempts

### Why this matters
This is not a dashboard, monitor, or rebalance strategy. It is a reusable execution gate that sits in front of downstream HODLMM actions and stops agents from acting on degraded pool conditions blindly.

That makes it more downstream-critical than another measurement layer alone.

### On-chain / live proof
This skill is read-only and does not broadcast transactions in v1.

Current proof surface is conservative:
- `status` returns clean local defaults and mode
- `run` returns deterministic gate output with proof hash
- current `doctor` output shows the live read paths as unreachable in this runtime, so the PR does not overclaim stronger live-read proof than it currently has

Observed live result:
- decision: `block`
- reasons:
  - `cooldown_active`
  - `apy_drawdown_above_limit`

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
  "action": "ready",
  "data": {
    "skill": "hodlmm-execution-guardrail",
    "version": "0.1.0",
    "statePath": "C:\\Users\\fazri\\.hodlmm-execution-guardrail-state.json",
    "defaults": {
      "cooldownHours": 4,
      "apyDrawdownLimitBps": 2500
    },
    "checks": [
      {
        "name": "Bitflow pools API",
        "ok": false,
        "detail": "unreachable"
      },
      {
        "name": "Bitflow app pools API",
        "ok": false,
        "detail": "unreachable"
      },
      {
        "name": "Hiro fee API",
        "ok": false,
        "detail": "unreachable"
      }
    ]
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
  "action": "block",
  "data": {
    "decision": "block",
    "poolId": "xyk-pool-sbtc-stx-v-1-1",
    "wallet": "SP137SY7VWJFMVBF9GMCSQ2GETC1FV5FYZVKXSMJ8",
    "reasons": [
      "cooldown_active",
      "apy_drawdown_above_limit"
    ],
    "checks": {
      "currentApy": 9,
      "recentMaxApy": 18,
      "apyDrawdownBps": 5000,
      "cooldownActive": true
    },
    "proof": {
      "skill": "hodlmm-execution-guardrail",
      "hash": "d3f6b839a83f16e9964172f25110d9f3c482dd01a083cc76447aa88a9b6bd9c3"
    }
  },
  "error": null
}
```
</details>

### Security notes
- Read-only
- No transactions submitted
- No funds moved
- Mainnet-oriented read paths only
- Fails closed on missing live data
- Does not claim wallet-specific live in-range verification in v1; it uses conservative pool/context checks only

### Additional notes
This skill is narrower than a broad HODLMM monitor. Its purpose is to stop unsafe downstream actions when pool conditions have degraded enough that an agent should not proceed blindly.
