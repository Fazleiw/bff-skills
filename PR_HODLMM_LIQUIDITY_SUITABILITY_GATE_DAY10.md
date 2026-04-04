## Skill Submission
**Skill name:** `hodlmm-liquidity-suitability-gate`
**Category:** Infrastructure
**HODLMM integration?** Yes

### What it does
`hodlmm-liquidity-suitability-gate` is a fail-closed HODLMM admission primitive for Bitflow liquidity agents. It answers one narrow operational question: **for this wallet and risk profile, is this liquidity position safe enough to hold, and if safe, is it suitable to add more size right now?**

It reads live Bitflow pool state, combines it with explicit user allocation context and a bounded risk profile, and emits one of four deterministic decisions:
- `block`
- `watch`
- `allow_hold`
- `allow_add`

The decision is driven by concrete hold/add suitability checks only:
- live liquidity depth
- live 24h and 7d activity context
- estimated entry slippage for the proposed add size
- pool composition balance
- current and post-add concentration against the user's risk limits

### Why this is useful
This is not a dashboard, broad optimizer, or portfolio manager.

- `hodlmm-risk` focuses on pool risk environment
- `hodlmm-pulse` focuses on timing and momentum
- `hodlmm-liquidity-suitability-gate` focuses on profile-aware hold/add suitability for a single pool decision

That makes it a reusable control primitive for treasury agents, LP deployers, allocators, and capital-routing flows that need a profile-aware admission rail before new size is added.

### On-chain / live proof
This skill is read-only and uses live Bitflow API state plus optional Hiro wallet readability in `doctor`.

A clean smoke path returns a machine-routable suitability decision using:
- live pool liquidity
- live 24h volume
- live 24h fees/APR context
- estimated slippage for the proposed size
- pool imbalance ratio
- user allocation constraints under a selected risk profile

Observed live smoke paths:
- `decision: watch` under `balanced`
  - reason: `pool_volume_below_profile_floor`
- `decision: allow_hold` under `low`
  - reasons:
    - `pool_liquidity_below_profile_floor`
    - `pool_volume_below_profile_floor`
    - `post_add_allocation_above_limit`

That proves the core utility: the primitive turns live pool conditions plus a user risk profile into differentiated hold/add decisions rather than a vague pool summary.

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
`doctor`
```json
{
  "status": "success",
  "action": "ready",
  "data": {
    "skill": "hodlmm-liquidity-suitability-gate",
    "network": "mainnet",
    "checks": {
      "bitflowPoolsReachable": true,
      "samplePoolId": "dlmm_1",
      "hiroReachable": true
    }
  },
  "error": null
}
```

`run`
```json
{
  "status": "success",
  "action": "Pool needs caution before any new capital is added",
  "data": {
    "decision": "watch",
    "suitability": "caution",
    "poolId": "dlmm_1",
    "riskProfile": "balanced",
    "checks": {
      "deployableBalanceUsd": 5000,
      "currentPoolAllocationUsd": 900,
      "addAmountUsd": 400,
      "nextPoolAllocationPct": 26,
      "recentActivityRatio": 0.0034,
      "slippageEstimateBps": 53,
      "imbalanceRatio": 1.5253,
      "poolVerified": false,
      "sbtcIncentives": false
    },
    "reasons": [
      "pool_volume_below_profile_floor"
    ]
  },
  "error": null
}
```

### Security notes
- Read-only: this skill does not submit transactions.
- It does not move funds.
- Mainnet-oriented: depends on live Bitflow and Hiro read surfaces.
- Fail-closed by design: degraded data or invalid profile inputs produce `block` or structured error.
- `allow_add` is an admission decision for downstream review, not unconditional permission to deploy.

### Additional notes
This skill is intentionally narrower than a broad liquidity optimizer. Its only job is to answer whether a single HODLMM pool is suitable to hold or add to for one user profile at a time.
