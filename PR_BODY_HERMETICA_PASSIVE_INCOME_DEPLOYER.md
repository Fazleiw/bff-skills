## Skill Submission

**Skill name:** `hermetica-passive-income-deployer`
**Category:** Yield
**HODLMM integration?** No

### What it does
Hermetica Passive Income Deployer is a narrow, write-capable passive-income deployment primitive for Stacks mainnet. It checks live Hermetica staking conditions, asks for the user's expected yield once, uses a disclosed default threshold when unanswered, and only prepares a Hermetica `staking-v1::stake` deploy path when the wallet actually has deployable USDh and the yield edge clears the action floor.

The skill is intentionally not an allocator, switchboard, or rotator. It keeps the story direct-profit + passive-income + Hermetica-only, and now hardens transparency so a wallet with `0` USDh cannot be presented as live-deployable.

### On-chain proof
Real Hermetica mainnet stake attempts were broadcast from Inner Whale via the exact deploy path:
- `0xc8d4eaf2838288ba3663b880193ad494c205c67a58b7f5c42a79d8df5fa810e1`
- `0x2e3630e9233dabe5a122c661a781244d314e74448bca90986546b48e29e67118`

Explorer links:
- <https://explorer.hiro.so/txid/c8d4eaf2838288ba3663b880193ad494c205c67a58b7f5c42a79d8df5fa810e1?chain=mainnet>
- <https://explorer.hiro.so/txid/2e3630e9233dabe5a122c661a781244d314e74448bca90986546b48e29e67118?chain=mainnet>

Important transparency note: these prove the session can unlock the wallet, sign, and broadcast the real Hermetica `staking-v1::stake` route. They do **not** prove a successful live deployment yet. Direct wallet-state checks show the Inner Whale wallet currently has `0` USDh and `0` sUSDh, so the correct present claim is: real on-chain execution proof exists, successful passive-income deployment proof does not yet exist.

### Registry compatibility checklist

- [x] `SKILL.md` uses `metadata:` nested frontmatter (not flat keys)
- [x] `AGENT.md` starts with YAML frontmatter (`name`, `skill`, `description`)
- [x] `tags` and `requires` are comma-separated quoted strings, not YAML arrays
- [x] `user-invocable` is the string `"true"`
- [x] `entry` path is repo-root-relative (no `skills/` prefix)
- [x] `metadata.author` field is present
- [x] All commands output JSON to stdout
- [x] Error output uses structured JSON with descriptive fields

### Smoke test results

<details>
<summary>doctor output</summary>

```json
{
  "status": "success",
  "action": "ready",
  "data": {
    "skill": "hermetica-passive-income-deployer",
    "exchangeRate": 1,
    "accumulatedYieldPct": 0,
    "stakingEnabled": true,
    "usdhTotalSupply": 9060017.95,
    "susdhTotalSupply": 1829292.64,
    "defaultExpectedYieldPct": 12,
    "note": "Hermetica deployment path reachable and proofable on-chain via staking-v1::stake",
    "transparency": "Successful live deployment should only be claimed when a tx hash and post-deploy wallet state both confirm receipt."
  },
  "error": null
}
```

</details>

<details>
<summary>run output</summary>

```json
{
  "status": "success",
  "action": "stay_idle",
  "data": {
    "wallet": "SP137SY7VWJFMVBF9GMCSQ2GETC1FV5FYZVKXSMJ8",
    "destination": "Hermetica",
    "expectedYieldTarget": 12,
    "targetSource": "default",
    "askPrompt": "what's your expected yield?",
    "message": "No expected yield was provided, so the default profitable threshold is being used.",
    "deployAmountUsdh": 0,
    "minDeployUsdh": 50,
    "stakingEnabled": true,
    "estimatedApyPct": 12,
    "deployEdgePct": 0,
    "reasons": [
      "no_deployable_usdh"
    ],
    "liveProof": {
      "available": false,
      "walletState": "no_deployable_usdh",
      "lastAttemptTxid": "0x2e3630e9233dabe5a122c661a781244d314e74448bca90986546b48e29e67118",
      "lastAttemptStatus": "failed",
      "note": "Live Hermetica stake path was exercised on-chain, but this wallet currently has 0 USDh so no successful deploy can be claimed honestly."
    }
  },
  "error": null
}
```

</details>

### Security notes
- Write-capable skill
- Mainnet only
- Hermetica only
- Deploy path is restricted to `staking-v1::stake`
- Deployment requires `--confirm`
- Skill fails closed on missing capital, weak yield edge, disabled staking, or insufficient gas
- Skill explicitly avoids overstating proof when the wallet lacks deployable USDh
