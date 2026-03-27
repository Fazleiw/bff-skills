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

## Step-by-step usage
1. Define strategy intent offchain.
2. Run `strategy-policy.ts run` to compile canonical policy JSON and produce `policy_hash`.
3. Commit the policy onchain through the registry contract path.
4. Run `strategy-execute.ts run` with the committed policy to validate the proposed action.
5. Only if allowed, execute the HODLMM / Bitflow action.
6. Capture the resulting tx hash.
7. Record the execution onchain with the same `strategy_id` so observers can trace policy -> skill -> tx.

## End goal
The goal is not to make an agent look smart. The goal is to make execution auditable. An observer should be able to verify what policy was committed, who executed it, what actions were allowed, and whether the final HODLMM/Bitflow action obeyed those limits.

## Known constraints
- Current version defines policy + execution wrappers and the registry contract draft.
- Full production execution still requires target contract addresses and final deployment path.
