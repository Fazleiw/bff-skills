### What this adds
This PR adds `hodlmm-cost-of-inaction-gate`, a fail-closed HODLMM decision primitive for Bitflow LP agents.

It answers one narrow operational question:

**is staying idle now more costly than rebalancing now?**

A position can be out of range without making a rebalance economically justified. This skill is built to stop both failure modes:
1. rebalancing too early under poor action quality
2. waiting too long once the cost of inactivity clearly exceeds the quality-adjusted cost of acting

That matters because downstream agents do not just need better measurement. They need a conservative decision gate that determines when waiting has become the more expensive mistake.

### What it reads
The skill uses live HODLMM and wallet-specific reads to evaluate:
- wallet position bins
- active bin
- drift severity
- pool APR and 24h volume support
- slippage quality
- gas quality
- cooldown state

### What it returns
One of four deterministic decisions:
- `rebalance_now`
- `wait`
- `do_not_rebalance`
- `block`

### Why this is different from adjacent HODLMM skills
This is not a dashboard, generic monitor, broad optimizer, or measurement-only analyzer.

- `hodlmm-risk` answers whether conditions are risky
- `hodlmm-bin-guardian` answers whether a position is in range and whether baseline rebalance gates pass
- analyzers tell you what the current state looks like
- `hodlmm-cost-of-inaction-gate` answers whether acting now is economically more justified than waiting

That makes it a reusable downstream decision primitive for HODLMM rebalance workflows, not just another way to describe position state.

### Strongest proof in this PR
#### 1) `rebalance_now`
Position is materially out of range, drift severity is above the rebalance threshold, APR and volume support intervention, and action-quality gates are acceptable.

#### 2) `wait`
Position is degraded, but current slippage quality is too poor to justify intervention now.

#### 3) `do_not_rebalance`
Position is still in range, so the skill short-circuits before pool-quality penalties can manufacture false urgency.

### Output quality
The skill returns deterministic JSON with:
- explicit `reasons`
- `whyNow` / `whyNotNow`
- score breakdowns for inactivity cost and action cost
- proof hash
- cooldown-aware gating behavior

### Scope discipline
This skill does **not** claim to:
- optimize all HODLMM actions
- predict exact profitability
- replace downstream execution review
- act as a rebalance executor

It is intentionally narrower:
**a conservative rebalance timing gate for HODLMM LP workflows**.

### Why agents need it
If a downstream workflow adds only one economic control layer before touching a HODLMM position, this is the gate it should add.

It does not merely estimate one loss surface. It decides whether inaction has become the costlier choice. That is a more downstream-critical question for any agent that must choose between waiting and intervention.
