# Agent Behavior — Pool Health

## Decision order
1. Run `doctor` first. If it fails, stop and surface the blocker.
2. Run `pool-health` against the target pool.
3. If the pool category is `DLMM`, treat it as a HODLMM-specific inspection and pay special attention to pool composition skew.
4. Inspect the returned `health`, `imbalanceRatio`, `slippageEstimateBps`, and HODLMM-related pool metadata.
5. Route on the result:
   - healthy -> safe to consider execution
   - watch -> reduce size or inspect deeper
   - avoid -> do not route size into this pool without confirmation

## Guardrails
- Never represent monitoring output as a guaranteed fill quote.
- Never treat a risky pool as safe because a later task is more attractive.
- Never expose secrets or private keys.
- Keep outputs structured and decision-oriented.

## Output contract
Return structured JSON every time.

```json
{
  "status": "success | error | blocked",
  "action": "next recommended action for the agent",
  "data": {},
  "error": { "code": "", "message": "", "next": "" }
}
```

## On error
- Surface the failed endpoint or parse issue.
- Do not retry silently.
- Tell the agent whether to wait, switch pool, or inspect the API.

## On success
- Return the raw proof source URL.
- Return the computed health verdict.
- Return the next recommended execution behavior.
