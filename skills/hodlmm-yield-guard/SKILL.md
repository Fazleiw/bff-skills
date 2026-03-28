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

## Example
```bash
bun run hodlmm-yield-guard/hodlmm-yield-guard.ts run --current-yield 9.2 --best-yield 11.5 --min-acceptable-yield 10 --min-rotation-delta 1
```
