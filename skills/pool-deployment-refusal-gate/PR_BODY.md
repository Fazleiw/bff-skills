## Skill Submission

**Skill name:** `pool-deployment-refusal-gate`  
**Category:** Infrastructure  
**HODLMM integration?** Yes

### What it does
`pool-deployment-refusal-gate` is a fail-closed pool admission primitive for Bitflow deployment agents. It answers one narrow operational question only: **should this single pool be admitted for fresh deployment right now, or should the agent refuse entry?**

It reads live Bitflow beta pool data, checks only the minimum entry bars needed for deployment safety, and emits one of three deterministic outcomes:
- `deploy_allowed`
- `wait`
- `block`

The purpose is not to describe pools. The purpose is to stop downstream agents from treating every live pool as deployable by default.

### Why this is useful
This is not a dashboard, pool ranker, or allocator.

- `pool-health` is descriptive and monitoring-oriented
- `pool-deployment-refusal-gate` standardizes a single admit-or-refuse boundary before downstream add-liquidity flows run

That makes it a reusable control primitive for one narrow failure only:

- deploying fresh capital into a live-but-weak pool just because the pool exists

### Why agents need this primitive
A deployment agent does not need another broad pool summary before acting. It needs a refusal rail.

This skill gives that rail in a form agents can chain directly:
- if deployment quality clears the minimum bars, return `deploy_allowed`
- if the pool is live but entry quality is weak, return `wait`
- if the pool lookup or live conditions fail badly enough, return `block`

That keeps the default behavior conservative without forcing every downstream skill to rebuild the same admission logic.

### Live proof
This skill uses the same proven Bitflow beta pool-read path as the reviewed `pool-health` skill, but it produces an operational admission decision instead of a descriptive health summary.

Built-in smoke proof from the current review path:
- `poolId`: `dlmm_3`
- `volume24hUsd`: `118233.21`
- `liquidityUsd`: `1056429.37`
- `slippageEstimateBps`: `1877`
- decision: `wait`
- reason: `estimated entry slippage is too high for fresh deployment right now`

Proof hash:
- `830ae02c33f6ea200abee0cec79c99afa647a87b6c22db3caa0d04ecf95d69d3`

### Registry compatibility checklist
- `SKILL.md` uses nested `metadata:` frontmatter
- `AGENT.md` starts with YAML frontmatter
- `tags` and `requires` are comma-separated strings
- `user-invocable` is the string `"false"`
- `entry` path is repo-root-relative
- `metadata.author` is present
- all commands emit JSON to stdout
- blocked/error paths emit structured JSON

### Smoke test results

`doctor`
```json
{
  "status": "success",
  "action": "wait",
  "data": {
    "poolId": "dlmm_3",
    "category": "DLMM",
    "checks": {
      "categoriesReachable": true,
      "metricsReachable": true,
      "groupedReachable": true,
      "poolFound": true,
      "samplePoolId": "dlmm_3",
      "sampleLiquidityUsd": 1056429.37,
      "sampleVolume24hUsd": 118233.21
    },
    "proof": {
      "skill": "pool-deployment-refusal-gate",
      "timestamp": "2026-04-01T00:35:53.357Z"
    }
  },
  "error": null
}
```

`run`
```json
{
  "status": "success",
  "action": "wait",
  "data": {
    "poolId": "dlmm_3",
    "checks": {
      "volume24hUsd": 118233.21,
      "volumeOk": true,
      "liquidityUsd": 1056429.37,
      "liquidityOk": true,
      "slippageEstimateBps": 1877,
      "slippageOk": false,
      "reserve0Usd": 1051102.42,
      "reserve1Usd": 5326.96
    },
    "decision": {
      "approved": false,
      "reason": "estimated entry slippage is too high for fresh deployment right now",
      "nextAction": "wait"
    },
    "proof": {
      "skill": "pool-deployment-refusal-gate",
      "timestamp": "2026-04-01T00:35:52.935Z",
      "hash": "830ae02c33f6ea200abee0cec79c99afa647a87b6c22db3caa0d04ecf95d69d3"
    }
  },
  "error": null
}
```

### Security notes
- Read-only: this skill does not submit transactions.
- It does not move funds.
- Fail-closed by design: missing pool data, invalid pool lookup, or clearly weak admission conditions produce `wait`, `block`, or structured error.
- `deploy_allowed` is only an admission approval for downstream deployment review, not unconditional deployment permission.

### Additional notes
This skill is intentionally narrower than a general pool-health monitor. It does not try to answer which pool is best, how much capital to deploy, or whether a broader strategy should rotate.

Its only job is to answer whether a single pool should be admitted for fresh deployment right now.
