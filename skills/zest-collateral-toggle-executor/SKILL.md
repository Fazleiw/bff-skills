---
name: zest-collateral-toggle-executor
description: "Direct executor for one narrow Zest operation: enabling or disabling sBTC collateral on a live zS BTC position. Hard-blocks low-gas or no-position states and requires explicit confirmation before emitting the execution command."
metadata:
  author: "griffinxbt"
  author-agent: "Tiny Marten"
  user-invocable: "true"
  arguments: "doctor | run --address <STX_ADDRESS> --enable <true|false> [--confirm]"
  entry: "zest-collateral-toggle-executor/zest-collateral-toggle-executor.ts"
  requires: ""
  tags: "defi, mainnet-only, zest, executor, safety, sBTC, l2"
---

# Zest Collateral Toggle Executor

Direct executor for one narrow Zest operation: enabling or disabling `sBTC` collateral on a live `zS BTC` position.

## What it does
This skill closes one real production loop: it checks whether a wallet has enough STX gas and a real `zS BTC` position, then — only with explicit `--confirm` — emits the exact contract execution command for `set-user-use-reserve-as-collateral` on Zest's live helper path.

It is intentionally narrow. It does **not** manage borrowing, supply, withdrawals, routing, or portfolio allocation. It exists to make one fragile collateral operation executable with repeatable guardrails.

## Why agents need it

Agents need a direct primitive for one fragile Zest helper path because collateral state affects what downstream borrow, withdrawal, and reserve-management flows can do next. In production, manually re-checking whether a wallet has enough gas and a real `zS BTC` position is slow and error-prone. This skill turns that repeated manual decision into a strict execution gate with explicit refusal states.

## Why this is production-real
This skill is built around a wallet that already touched the exact same helper function in production:
- one successful collateral-toggle transaction
- three aborted collateral-toggle attempts
- live `zS BTC` balance on the same wallet

That makes this an execution primitive for an already-proven path, not an aspirational wrapper.

## On-chain proof
- **STX address:** `SP4DXVEC16FS6QR7RBKGWZYJKTXPC81W49W0ATJE`
- **BTC address:** `bc1qyu22hyqr406pus0g9jmfytk4ss5z8qsje74l76`
- **Helper contract:** `SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.borrow-helper-v2-1-7`
- **Function:** `set-user-use-reserve-as-collateral`
- latest successful tx: `0xc9ca5d55f71db8e1ec482e9bff6161f2ad0b1cda9554516e3efa00a817ebd7a9`
- latest abort tx: `0xb5fbb202a8daa478435097343d8dce0ef81d4615c409d5a3b1b094c1abe73696` with `(err u30024)`

## Safety notes
- blocks if STX gas is below `150000` uSTX
- blocks if wallet has no live `zS BTC` position
- requires `--confirm` before emitting execution commands
- no broad routing or multi-step strategy logic
- returns strict JSON for both success and refusal states

## Commands

### doctor
```bash
bun run skills/zest-collateral-toggle-executor/zest-collateral-toggle-executor.ts doctor --address SP4DXVEC16FS6QR7RBKGWZYJKTXPC81W49W0ATJE
```

### run
```bash
bun run skills/zest-collateral-toggle-executor/zest-collateral-toggle-executor.ts run --address SP4DXVEC16FS6QR7RBKGWZYJKTXPC81W49W0ATJE --enable true --confirm
```

## Output contract

**doctor**
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

**run success**
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
          "enableAsCollateral": true
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

**run refusal**
```json
{
  "status": "error",
  "action": "Blocked: --confirm required to enable collateral",
  "data": null,
  "error": {
    "code": "CONFIRM_REQUIRED",
    "message": "--confirm required to enable collateral",
    "next": "Re-run with --confirm to emit the execution command."
  }
}
```
