## Skill Submission
**Skill name:** `zest-collateral-toggle-executor`
**Category:** Infrastructure
**HODLMM integration?** No

### What it does
`zest-collateral-toggle-executor` is a fail-closed Zest execution primitive for one narrow operation: **enable or disable `sBTC` collateral on a live `zS BTC` position**. It checks live wallet balances, confirms the wallet actually holds `zS BTC`, enforces a minimum STX gas floor, requires explicit `--confirm`, and then emits the exact `call_contract` execution command for `set-user-use-reserve-as-collateral` on Zest's live helper path.

### Why this is useful
This is not a dashboard, generic monitor, or broad strategy tool.
- `zest-reserve-guard` answers whether a wallet is maintaining a liquid reserve
- `zest-collateral-toggle-guard` answers whether a collateral toggle should be allowed
- `zest-collateral-toggle-executor` answers whether the toggle can be executed safely **and emits the exact execution command when it can**

That makes it a reusable control primitive for downstream borrow, withdrawal, and reserve-management workflows on the same Zest position.

### On-chain / live proof
This skill uses live Hiro reads in `doctor` and `run`.

A clean confirmed smoke path returns:
- `status: success`
- `action: ENABLE_COLLATERAL`
- one `mcp_commands` item with tool `call_contract`
- proof references:
  - latest success tx: `0xc9ca5d55f71db8e1ec482e9bff6161f2ad0b1cda9554516e3efa00a817ebd7a9`
  - latest abort tx: `0xb5fbb202a8daa478435097343d8dce0ef81d4615c409d5a3b1b094c1abe73696`

### Registry compatibility checklist
- [x] `SKILL.md` uses `metadata:` nested frontmatter (not flat keys)
- [x] `AGENT.md` starts with YAML frontmatter (`name`, `skill`, `description`)
- [x] `tags` and `requires` are comma-separated quoted strings, not YAML arrays
- [x] `user-invocable` is the string `"true"`, not a boolean
- [x] `entry` path is repo-root-relative (no `skills/` prefix)
- [x] `metadata.author` field is present with GitHub username
- [x] All commands output JSON to stdout
- [x] Error output uses a structured JSON payload to stdout

### Smoke test results
<details>
<summary>doctor output</summary>

```json
{
  "status": "ok",
  "action": "READY",
  "data": {
    "network": "mainnet",
    "address": "SP4DXVEC16FS6QR7RBKGWZYJKTXPC81W49W0ATJE",
    "contracts": {
      "borrowHelper": "SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.borrow-helper-v2-1-7",
      "lpToken": "SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.zsbtc-v2-0",
      "asset": "SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token",
      "oracle": "SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.stx-btc-oracle-v1-4"
    },
    "balances": {
      "stxGasUstx": 29635799,
      "walletSbtcSats": 231510,
      "suppliedZsbtcSats": 245001
    },
    "proof": {
      "collateralToggleSuccessCount": 1,
      "collateralToggleAbortCount": 3,
      "latestSuccessfulTxId": "0xc9ca5d55f71db8e1ec482e9bff6161f2ad0b1cda9554516e3efa00a817ebd7a9",
      "latestAbortTxId": "0xb5fbb202a8daa478435097343d8dce0ef81d4615c409d5a3b1b094c1abe73696",
      "latestAbortCode": "(err u30024)"
    }
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
  "action": "ENABLE_COLLATERAL",
  "data": {
    "network": "mainnet",
    "address": "SP4DXVEC16FS6QR7RBKGWZYJKTXPC81W49W0ATJE",
    "balances": {
      "stxGasUstx": 29635799,
      "walletSbtcSats": 231510,
      "suppliedZsbtcSats": 245001
    },
    "decision": {
      "allowed": true,
      "status": "ready",
      "reason": "Wallet has zS BTC and enough STX gas to enable collateral",
      "executionReady": true
    },
    "mcp_commands": [
      {
        "step": 1,
        "tool": "call_contract",
        "description": "Enable Zest sBTC collateral on the live zS BTC position",
        "params": {
          "contract": "SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.borrow-helper-v2-1-7",
          "function": "set-user-use-reserve-as-collateral",
          "wallet": "SP4DXVEC16FS6QR7RBKGWZYJKTXPC81W49W0ATJE",
          "lpToken": "SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.zsbtc-v2-0",
          "asset": "SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token",
          "oracle": "SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.stx-btc-oracle-v1-4",
          "enableAsCollateral": true,
          "note": "Use current oracle bytes from the execution environment. This skill enforces whether execution should proceed and emits the exact intended helper call."
        }
      }
    ],
    "proof": {
      "collateralToggleSuccessCount": 1,
      "collateralToggleAbortCount": 3,
      "latestSuccessfulTxId": "0xc9ca5d55f71db8e1ec482e9bff6161f2ad0b1cda9554516e3efa00a817ebd7a9",
      "latestAbortTxId": "0xb5fbb202a8daa478435097343d8dce0ef81d4615c409d5a3b1b094c1abe73696",
      "latestAbortCode": "(err u30024)"
    }
  },
  "error": null
}
```
</details>

### Security notes
- Execution-oriented: this skill emits the exact execution command for one contract function only.
- It does **not** broaden into borrow, supply, withdraw, or routing logic.
- Mainnet-oriented: depends on live Hiro reads.
- Fail-closed by design: low gas, missing position, or missing `--confirm` return structured refusal instead of unsafe execution.
- Narrow by design: one function, one asset path, one operation.

### Additional notes
This skill is intentionally narrower than a generic Zest manager. Its purpose is to prevent two symmetric failures on a real collateral helper path:
1. treating a fragile collateral toggle like a casual button click
2. trying to execute the toggle when the wallet state is not ready or not explicitly confirmed
