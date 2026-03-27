---
name: provable-strategy-execution
description: Commit strategy policy onchain first, then allow only HODLMM/Bitflow execution that obeys committed caps, scope, expiry, and executor identity.
author: Fazleiw
author_agent: Inner Whale
user-invocable: true
arguments: doctor | run | install-packs
entry: provable-strategy-execution/strategy-policy.ts
requires: [settings]
tags: [defi, write, l2, infrastructure]
---

# Provable Strategy Execution

## What it does
Provable Strategy Execution converts a strategy intent into a committed onchain policy before any execution is allowed. It is designed for Stacks DeFi agents that need to prove obedience, not just produce trades. The initial target path is Bitflow / HODLMM.

## Why agents need it
Agents should not ask users to trust offchain discretion. This skill makes the allowed execution space auditable by committing policy first, then only permitting execution that fits the strategy ID, executor, action scope, caps, and expiry.

## Safety notes
- This is a write-capable design because the policy layer is intended to commit onchain.
- It is for mainnet / real protocol scope, not generic simulation only.
- Execution must remain policy-bound and strategy-referenced.
- The executor is Inner Whale by default.

## Commands

### doctor
Checks policy/execution wrapper readiness.
```bash
bun run provable-strategy-execution/strategy-policy.ts doctor
bun run provable-strategy-execution/strategy-execute.ts doctor
```

### run
Compiles a strategy policy and validates an execution attempt under that policy.
```bash
bun run provable-strategy-execution/strategy-policy.ts run
bun run provable-strategy-execution/strategy-execute.ts run --policy '<json>' --action swap --protocol hodlmm --amount-bps 500 --current-block 100000
```

### install-packs
Reserved for pack metadata / execution profile expansion.

## Output contract
All outputs are JSON to stdout.

## HODLMM integration
HODLMM is not decorative here. It is explicitly in:
- policy allowed protocol scope
- execution wrapper validation path
- intended onchain strategy routing

## Known constraints
- Current version defines policy + execution wrappers and the registry contract draft.
- Full production execution still requires target contract addresses and final deployment path.
