## What this skill does
Adds `zest-position-health-guardian`, a narrow read-only infrastructure primitive for checking whether a Zest lending position is healthy enough for downstream capital decisions.

Instead of managing supply/withdraw flows broadly, it returns a fail-closed `HEALTHY` / `WATCH` / `BLOCKED` decision surface that other treasury or lending agents can call before reusing capital.

## Why this is distinct
This is intentionally narrower than generic Zest yield managers.
It does **not** try to do supply automation, reward claiming, or broad treasury routing. Its job is to provide a composable position-health gate.

## On-chain proof / live output
This is a **read-only** infrastructure skill, so the proof standard here is live deterministic output rather than a write tx hash.

Smoke tests run in repo context against:
- `SP137SY7VWJFMVBF9GMCSQ2GETC1FV5FYZVKXSMJ8`

### doctor
```bash
STX_ADDRESS=SP137SY7VWJFMVBF9GMCSQ2GETC1FV5FYZVKXSMJ8 bun run skills/zest-position-health-guardian/zest-position-health-guardian.ts doctor
```
Returned success with live STX balance and Zest probe output.

### status
```bash
STX_ADDRESS=SP137SY7VWJFMVBF9GMCSQ2GETC1FV5FYZVKXSMJ8 bun run skills/zest-position-health-guardian/zest-position-health-guardian.ts status --asset sBTC
```
Returned:
- `classification: HEALTHY`
- structured JSON output
- explicit thresholds

Full output is included in `skills/zest-position-health-guardian/proof.md`.

## HODLMM integration
- No direct HODLMM integration in this version.

## Smoke test checklist
- [x] `bun run scripts/generate-manifest.ts`
- [x] `bun run skills/zest-position-health-guardian/zest-position-health-guardian.ts doctor`
- [x] `bun run skills/zest-position-health-guardian/zest-position-health-guardian.ts status --asset sBTC`

## Notes
- read-only
- mainnet-only
- fail-closed on missing or degraded reads
- designed as a composable risk primitive rather than a broad manager
