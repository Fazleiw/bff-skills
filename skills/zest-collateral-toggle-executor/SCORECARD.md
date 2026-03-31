# BFF Pre-Submit Scorecard — zest-collateral-toggle-executor

## BFF / Judged Skill Pre-PR Scorecard

- **Reviewed-file implementation evidence:** 2/2
  - executable TS file exists
  - doctor / refusal / confirmed success paths all smoke-tested
- **Doc/code match:** 2/2
  - docs match actual CLI behavior and JSON outputs
- **Enforced safety in code:** 2/2
  - hard refusal on low gas, no position, and missing `--confirm`
- **Proof quality:** 2/2
  - live balances, real tx ids, refusal proof, and success proof all visible
- **Agent leverage / reusability:** 2/2
  - reusable primitive before borrow / risk / reserve flows on the same Zest position
- **Claim narrowness / clarity:** 2/2
  - one operation only: execute or refuse a collateral toggle

### Total: 12/12

## Judge Style Rubric

### Non-negotiable blocker checks
- **Hygiene:** 2/2
- **Doc / code match:** 2/2
- **Enforced safety:** 2/2
- **Proof visibility:** 2/2

### Winner-shape scoring
- **Primitive narrowness:** 2/2
- **Downstream leverage:** 2/2
- **Reviewer clarity:** 2/2
- **Competitive taste:** 2/2
  - narrower and more execution-complete than the guard version, with better winner fit for a production-real primitive

### Total: 16/16

## Pre-mortem
1. Most likely lose reason: a competitor ships an even cleaner executor on a more obviously valuable protocol path.
2. Benchmark threat: any equally narrow write-capable primitive with stronger direct proof of repeated production use.
3. Missing proof: this wrapper emits the exact execution command but does not itself broadcast the raw tx.
4. Category crowding: broad Zest/yield is crowded, collateral toggle execution specifically is still comparatively narrow.
5. Best sharpening cut left: keep the PR brutally short and centered on one thing — direct safe execution for a fragile helper call.

## Verdict
**Submit.**
Current estimate: **80%+ contender range**, assuming PR hygiene stays clean and the field does not produce a sharper narrow executor on the same day.
