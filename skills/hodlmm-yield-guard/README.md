# HODLMM Yield Guard

HODLMM Yield Guard is a HODLMM-first Bitflow skill that turns live yield data into a clear execution decision:
- `stay`
- `rotate`
- `alert`

This is not just a dashboard helper. The latest version also produces deterministic proof material that can be anchored onchain.

## What it does
The skill fetches live Bitflow APY data, checks the current pool against a policy threshold, compares it to the best filtered alternative, and returns one concrete action.

Decision policy:
- `stay` when current yield remains acceptable
- `rotate` when current yield is below threshold or materially worse than a better filtered alternative
- `alert` when current yield is degrading but there is not yet a clearly superior executable alternative

## Why this matters
Most yield-monitoring tools stop at reporting. This skill is built as an execution guard:
- it reads live market state
- it converts that state into a deterministic action
- it packages the action into proof material that can be signed and anchored onchain

That makes it much closer to agent execution infrastructure than passive analytics.

## Proof design
The skill emits a proof object containing:
- `skillName`
- `skillVersion`
- `timestamp`
- `executionPayload`
- `proof.hash`

`proof.hash` is a SHA-256 hash over a stable serialized decision payload. If the same inputs and decision are reproduced, the same proof hash is reproduced.

This gives the agent a clean way to bind:
1. live data
2. decision logic
3. execution intent
4. public proof anchor

## Onchain proof demonstrated in this PR
A real Stacks transaction was broadcast to anchor a live HODLMM Yield Guard decision.

### Decision proven
- skill: `hodlmm-yield-guard`
- decision: `rotate`
- from pool: `xyk-pool-sbtc-stx-v-1-1`
- to pool: `xyk-pool-psbtc-stx-v-1-1`

### Proof artifacts
- proofHash: `77768f6127c88f83e769f36b17cc525e878fdaeb5ab0f0c2c8b1637adbf67dcb`
- signed message: `77768f6127c88f83e769f36b17cc525e878fdaeb5ab0f0c2c8b1637adbf67dcb|2026-03-28T05:27:31.163Z|hodlmm-yield-guard`
- wallet: `SP137SY7VWJFMVBF9GMCSQ2GETC1FV5FYZVKXSMJ8`
- tx hash: `9e3ac304f98a68491351115f694a928aa1df4efbb56a2ec529a64e71609507db`
- explorer: `https://explorer.hiro.so/txid/9e3ac304f98a68491351115f694a928aa1df4efbb56a2ec529a64e71609507db?chain=mainnet`

### How the tx is tied to the skill
The transaction memo embeds the proof hash prefix derived from the exact skill decision payload. That gives a public onchain pointer back to the skill's deterministic output.

## What this proof means
This proof does **not** claim that a full autonomous pool rotation already executed end-to-end onchain.

It proves three narrower and important things already work:
1. live Bitflow yield data can drive the decision
2. the skill produces deterministic proof-ready execution output
3. the resulting decision can be signed and anchored onchain with a real transaction

That is meaningful because it upgrades the skill from:
- "monitoring tool"

to:
- "provable execution guard"

## Example run
```bash
bun run hodlmm-yield-guard/hodlmm-yield-guard.ts run --current-pool xyk-pool-sbtc-stx-v-1-1 --threshold 10 --min-delta 1 --filter xyk-pool
```

## Example output shape
```json
{
  "status": "success",
  "action": "rotate",
  "decisionContext": {
    "executionPayload": {
      "targetPool": "xyk-pool-psbtc-stx-v-1-1",
      "action": "rotate"
    },
    "proof": {
      "skillName": "hodlmm-yield-guard",
      "skillVersion": "0.2.0",
      "timestamp": "2026-03-28T05:27:31.163Z",
      "hash": "77768f6127c88f83e769f36b17cc525e878fdaeb5ab0f0c2c8b1637adbf67dcb"
    }
  }
}
```

## Why PR #43 is stronger now
This PR now demonstrates:
- live data integration
- real decision logic
- deterministic proof construction
- real onchain proof anchor

That combination is a much stronger BFF submission than a static policy script or a read-only monitor.
