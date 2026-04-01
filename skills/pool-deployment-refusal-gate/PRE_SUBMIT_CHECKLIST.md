# Pool Deployment Refusal Gate — Pre-Submit Checklist

## Must pass before PR
- [ ] `SKILL.md` frontmatter uses nested `metadata:`
- [ ] `AGENT.md` starts with YAML frontmatter
- [ ] `entry` path is `pool-deployment-refusal-gate/pool-deployment-refusal-gate.ts`
- [ ] `tags` and `requires` are comma-separated strings
- [ ] `user-invocable` is the string `"false"`
- [ ] command surface in docs matches code exactly: `doctor | status | run`
- [ ] output contract examples match actual `doctor` and `run` output keys
- [ ] PR title uses Day 7 competition shape
- [ ] PR body uses the current rewritten `PR_BODY.md`

## Must verify live
- [ ] `doctor` succeeds on the live Bitflow beta endpoint
- [ ] `run` succeeds on a real pool id
- [ ] proof hash in PR body matches the latest successful `run` output
- [ ] `poolId`, `volume24hUsd`, `liquidityUsd`, and `slippageEstimateBps` in PR body match the latest live output

## Must keep in wording
- [ ] admission primitive
- [ ] admit-or-refuse boundary
- [ ] fail-closed refusal rail
- [ ] not a dashboard / ranker / allocator / optimizer

## Must avoid in wording
- [ ] no “best pool” language
- [ ] no “strategy” language
- [ ] no “allocation engine” language
- [ ] no claims beyond read-only proof

## Final go/no-go
Go only if:
- docs and code still match 1:1
- smoke proof is still live and consistent
- PR body still reads like an admission primitive, not `pool-health` renamed
