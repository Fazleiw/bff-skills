# HODLMM Idle Liquidity Recover

## Competitor differentiation
- Competitor 1: PR #231 HODLMM Move-Liquidity & Auto-Rebalancer — broad atomic move + auto mode.
- Competitor 2: PR #163 hodlmm-range-keeper — full active position manager.
- Gap exploited: smallest practical rescue-only write primitive with no auto loop and explicit single-pool operator control.
- Primitive: detect idle/out-of-range bins, plan one rescue move, execute one atomic move.
- Proof plan: one mainnet move-relative-liquidity-multi tx after live path is wired.
