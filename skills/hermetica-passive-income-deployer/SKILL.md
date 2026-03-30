---
name: hermetica-passive-income-deployer
description: "Fail-closed passive-income deployer for Stacks mainnet. Checks live Hermetica staking conditions and deploys eligible USDh capital only when yield conditions justify passive-income entry. Write-capable: outputs Hermetica staking MCP commands with explicit threshold and confirmation requirements."
metadata:
  author: "Fazleiw"
  author-agent: "Inner Whale"
  user-invocable: "true"
  arguments: "doctor | status | run [--wallet <STX_ADDRESS>] [--action <assess|deploy>] [--amount <usdh>] [--expected-yield <pct>] [--confirm]"
  entry: "hermetica-passive-income-deployer/hermetica-passive-income-deployer.ts"
  requires: "settings"
  tags: "defi, hermetica, passive-income, staking, write, mainnet-only, l2"
---

# Hermetica Passive Income Deployer

## What it does
Hermetica Passive Income Deployer is a write-capable passive-income deployment skill for Stacks mainnet. It checks live Hermetica staking conditions, uses the user's expected yield target when provided, and deploys eligible USDh capital into Hermetica only when the yield conditions justify passive-income entry.

If the user does not provide an expected yield target, the skill uses a default profitable threshold of 12% and explicitly discloses that it did so.

## Why agents need it
Yield farmers want passive income, not endless monitoring. This skill turns that intent into a narrow deploy decision: if the live passive-income conditions are good enough, deploy into Hermetica; if they are not, wait or stay idle.

The wedge is intentionally narrower than a generic staking helper: it binds deployment to an explicit expected-yield target and refuses to deploy when that target or the action-quality floor is not met.

## Safety notes
- Write-capable: deploy actions require `--confirm`.
- Hermetica only: this skill does not route across many destinations.
- Fail-closed: missing data or weak action quality blocks deployment.
- Mainnet-only: depends on live Hermetica and Hiro reads.

## Commands

### doctor
Checks Hermetica contracts and public APIs.
```bash
bun run skills/hermetica-passive-income-deployer/hermetica-passive-income-deployer.ts doctor
```

### status
Returns thresholds, default yield target, and deploy state.
```bash
bun run skills/hermetica-passive-income-deployer/hermetica-passive-income-deployer.ts status
```

### run
Assesses or deploys into Hermetica.
```bash
bun run skills/hermetica-passive-income-deployer/hermetica-passive-income-deployer.ts run --wallet SP1234...
bun run skills/hermetica-passive-income-deployer/hermetica-passive-income-deployer.ts run --wallet SP1234... --action=deploy --confirm
bun run skills/hermetica-passive-income-deployer/hermetica-passive-income-deployer.ts run --wallet SP1234... --expected-yield 15
```

## Output contract
All outputs are JSON to stdout.

```json
{
  "status": "success | error | blocked",
  "action": "deploy_now | stay_idle | wait | block",
  "data": {
    "expectedYieldTarget": 12,
    "targetSource": "user | default",
    "deployAmountUsdh": 500,
    "stakingEnabled": true,
    "estimatedApyPct": 14.2,
    "mcp_commands": []
  },
  "error": null
}
```

## Known constraints
- Narrow by design: Hermetica only.
- Uses a default profitable threshold of 12% when no target is provided.
- The current implementation expects the caller/agent layer to provide the user's expected yield; if omitted, the default threshold is disclosed in output.
- Write actions require `--confirm` and must remain proofable on-chain via the Hermetica staking path.
- If the wallet has no deployable USDh, the skill must stay idle or block deployment rather than manufacturing a passive-income action.
- Transparency requirement: do not imply live deployability from a wallet that currently has `0` USDh. A real successful deploy claim requires both a transaction hash and post-deploy wallet state showing actual Hermetica position receipt.

## Current proof status
- Real session proof now exists that the Inner Whale wallet can be unlocked locally and can sign/broadcast real Stacks transactions to Hermetica `staking-v1::stake`.
- Two real on-chain stake attempts were broadcast from Inner Whale, which proves the path is executable from-session.
- Current live blocker is not runtime access; it is wallet state: Inner Whale currently has `0` USDh and `0` sUSDh on-chain, so a live successful deploy cannot be honestly claimed from this wallet until capital exists.
- Therefore the correct current posture is: real on-chain execution proof exists, but successful passive-income deployment proof does not yet exist.
