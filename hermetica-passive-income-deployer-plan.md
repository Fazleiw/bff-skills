# Hermetica Passive Income Deployer — Build Plan

## Goal
Create a narrower, more passive-income-oriented write-capable Hermetica skill that deploys eligible sBTC-side capital into Hermetica only when yield conditions justify the move and the action can be proved on-chain.

## Why this build is valid
- previous winner `hermetica-yield-rotator` already proves the Hermetica on-chain path is real and accepted by judges
- our narrower version removes cross-protocol routing breadth and focuses on one passive-income deployment destination
- on-chain proof path remains mandatory: write action must emit MCP commands / tx-ready contract calls and surface post-deploy proof expectations

## Hard guardrails
- Hermetica only
- deploy decision only
- ask: "what’s your expected yield?"
- if unanswered, use default profitable threshold and disclose it
- fail-closed on missing live data or weak action quality
- no generic allocator / router / switchboard language

## Core commands
- doctor
- status
- run --wallet <STX_ADDRESS> [--action <assess|deploy>] [--amount <usdh>] [--expected-yield <pct>] [--confirm]

## Outputs
- deploy_now
- stay_idle
- wait
- block

## Proof path
- live Hermetica contract reads
- wallet balance check
- deploy MCP command for Hermetica stake path
- explicit amount / threshold / target source (`user` vs `default`)
- post-deploy expectation in output

## Build strategy
1. fork winning Hermetica path as baseline for real proofability
2. cut cross-protocol rotation logic entirely
3. keep only passive-income deployment path into Hermetica
4. add expected yield prompt/default threshold behavior into docs + agent rules
5. validate that the resulting skill still reads as direct-profit and passive-income first
