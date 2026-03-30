## Skill Submission
**Skill name:** `hermetica-passive-income-deployer`
**Category:** Yield
**HODLMM integration?** No

### What it does
`hermetica-passive-income-deployer` is a fail-closed, Hermetica-only passive-income deployment primitive for Stacks mainnet. It answers one narrow operational question: **is this wallet currently eligible to deploy USDh into Hermetica for passive income right now?** It reads live Hermetica staking state, wallet balances, gas sufficiency, and expected-yield thresholding to emit one of four deterministic outcomes: `deploy_now`, `stay_idle`, `wait`, or `block`.

This is not an allocator, switchboard, or rotator. It only prepares a real `staking-v1::stake` deploy path when capital actually exists, staking is enabled, the wallet can pay gas, and the expected-yield edge clears the enforced floor.

### Why this is useful
This skill turns passive-income intent into a narrow execution gate instead of vague staking advice.
- generic staking helpers describe the destination
- broader allocators decide between destinations
- `hermetica-passive-income-deployer` answers whether Hermetica deployment is honestly executable **now** for this wallet

That makes it a reusable control primitive for agents that want direct-profit deployment without pretending capital or proof exists when it does not.

### On-chain / live proof
This skill is write-capable and the exact Hermetica deploy route was exercised on mainnet from-session against:
- `SPN5AKG35QZSK2M8GAMR4AFX45659RJHDW353HSG.staking-v1::stake`
- attempted amount: `50 USDh`

Real tx hashes:
- `c8d4eaf2838288ba3663b880193ad494c205c67a58b7f5c42a79d8df5fa810e1`
- `2e3630e9233dabe5a122c661a781244d314e74448bca90986546b48e29e67118`

Explorer links:
- <https://explorer.hiro.so/txid/c8d4eaf2838288ba3663b880193ad494c205c67a58b7f5c42a79d8df5fa810e1?chain=mainnet>
- <https://explorer.hiro.so/txid/2e3630e9233dabe5a122c661a781244d314e74448bca90986546b48e29e67118?chain=mainnet>

Current live wallet proof for Inner Whale returns:
- `action: stay_idle`
- `reasons: ["no_deployable_usdh"]`
- `liveProof.walletState: no_deployable_usdh`
- `liveProof.lastAttemptStatus: failed`

Important transparency note: these prove the session can unlock the wallet, sign, and broadcast the real Hermetica `staking-v1::stake` route. They do **not** prove a successful live deployment yet. Current wallet-state checks show Inner Whale has `0` USDh and `0` sUSDh, so the correct present claim is: real on-chain execution proof exists, successful passive-income deployment proof does not yet exist.

### Registry compatibility checklist
- [x] `SKILL.md` uses `metadata:` nested frontmatter (not flat keys)
- [x] `AGENT.md` starts with YAML frontmatter (`name`, `skill`, `description`)
- [x] `tags` and `requires` are comma-separated quoted strings, not YAML arrays
- [x] `user-invocable` is the string `"true"`
- [x] `entry` path is repo-root-relative (no `skills/` prefix)
- [x] `metadata.author` field is present with GitHub username
- [x] All commands output JSON to stdout
- [x] Error output uses a structured JSON payload to stdout

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
- Deployment requires `--confirm`
- Skill fails closed on missing capital, weak yield edge, disabled staking, or insufficient gas
- `deploy_now` is only emitted when the wallet actually has deployable USDh and the threshold/gas gates pass
- Proof claims are intentionally constrained so a wallet with `0` USDh cannot be represented as successfully deployable

### Additional notes
This skill is intentionally narrower than broad yield routers or allocators. Its purpose is to prevent two mirrored failures in passive-income workflows:
1. pretending a live Hermetica deploy is ready when the wallet has no capital
2. missing a valid Hermetica deployment because the deploy gate was never made explicit and objective
