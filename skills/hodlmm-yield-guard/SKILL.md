---
name: hodlmm-yield-guard
description: HODLMM-first threshold-based yield decision skill that tells agents when to stay, rotate, or alert based on APY drift and better Bitflow alternatives.
author: Fazleiw
author_agent: Inner Whale
user-invocable: true
arguments: doctor | run
entry: hodlmm-yield-guard/hodlmm-yield-guard.ts
requires: [settings]
tags: [defi, hodlmm, yield, l2]
---

# HODLMM Yield Guard

## What it does
HODLMM Yield Guard compares a current HODLMM/Bitflow yield position against user-defined thresholds and the best available alternative yield. It outputs a clear execution decision:
- `stay`
- `rotate`
- `alert`

## Why agents need it
Yield monitoring alone is not enough. Agents need policy-like rules that determine whether a position should stay live, rotate to a better opportunity, or trigger an alert before yield degradation becomes costly.

## Core logic
- If current yield is still above the minimum acceptable threshold: `stay`
- If current yield falls below threshold and a better alternative beats it by the required delta: `rotate`
- Otherwise: `alert`

## HODLMM integration
This skill is HODLMM-first by design. The primary decision flow assumes the current position is a HODLMM/Bitflow earn position and evaluates whether that position should remain active versus a better available alternative.

## Proof output
The skill now emits deterministic proof material alongside the decision:
- `skillName`
- `skillVersion`
- `timestamp`
- `executionPayload`
- `proof.hash`

The proof hash is a SHA-256 hash over a stable serialized decision payload. This lets an operator or downstream executor bind one exact yield decision to one exact onchain action.

## Onchain proof used in PR
A real Stacks transaction was broadcast using the skill's proof output:
- decision: `rotate`
- from pool: `xyk-pool-sbtc-stx-v-1-1`
- to pool: `xyk-pool-psbtc-stx-v-1-1`
- proofHash: `77768f6127c88f83e769f36b17cc525e878fdaeb5ab0f0c2c8b1637adbf67dcb`
- tx: `9e3ac304f98a68491351115f694a928aa1df4efbb56a2ec529a64e71609507db`
- explorer: `https://explorer.hiro.so/txid/9e3ac304f98a68491351115f694a928aa1df4efbb56a2ec529a64e71609507db?chain=mainnet`

The transaction memo embeds the proof hash prefix, creating a public chain reference that ties the transaction back to the exact skill decision payload.

## What the proof means
This proof does not claim full autonomous capital rotation yet. It proves three narrower things already work end-to-end:
1. live Bitflow yield data was fetched
2. the skill produced a deterministic rotate decision
3. that decision was packaged into proof material and anchored onchain with a real transaction

That makes HODLMM Yield Guard a provable execution guard, not just a monitoring script.

## Example
```bash
bun run hodlmm-yield-guard/hodlmm-yield-guard.ts run --current-yield 9.2 --best-yield 11.5 --min-acceptable-yield 10 --min-rotation-delta 1
```
