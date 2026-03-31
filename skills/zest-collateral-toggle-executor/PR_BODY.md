## Summary

This PR adds `zest-collateral-toggle-executor`, a direct execution primitive for one narrow Zest operation: enabling or disabling `sBTC` collateral on a live `zS BTC` position.

It is intentionally narrow. It does **not** manage borrowing, supply, withdrawals, routing, or strategy. It closes one production loop only: if the wallet has a real position and enough gas, and the operator explicitly confirms intent, emit the exact execution command for `set-user-use-reserve-as-collateral`.

## Why this exists

The underlying helper path is real, useful, and failure-prone.

This skill standardizes that path into a repeatable executor with fail-closed guardrails:
- block when STX gas is too low
- block when the wallet has no live `zS BTC` position
- block when `--confirm` is missing
- emit strict JSON on both refusal and success
- return the exact execution command for the intended helper call

## Production proof

Built from a real wallet already using the same Zest collateral surface:

- **STX:** `SP4DXVEC16FS6QR7RBKGWZYJKTXPC81W49W0ATJE`
- **BTC:** `bc1qyu22hyqr406pus0g9jmfytk4ss5z8qsje74l76`
- **Helper contract:** `SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.borrow-helper-v2-1-7`
- **Function:** `set-user-use-reserve-as-collateral`

Observed live proof during build:
- successful collateral toggle tx count: **1**
- aborted collateral toggle tx count: **3**
- latest success: `0xc9ca5d55f71db8e1ec482e9bff6161f2ad0b1cda9554516e3efa00a817ebd7a9`
- latest abort: `0xb5fbb202a8daa478435097343d8dce0ef81d4615c409d5a3b1b094c1abe73696` with `(err u30024)`
- live wallet state at review time:
  - STX gas: `29635799` uSTX
  - wallet sBTC: `231510` sats
  - supplied zS BTC: `245001`

That is the core thesis of this PR: the path is already proven **both executable and easy to fail**, so a narrow execution primitive with hard refusal logic is useful in production.

## Commands

### doctor
Confirms contract targets, live balances, and collateral-toggle proof surface.

### run
Checks preconditions and:
- refuses with structured JSON if the action is unsafe or unconfirmed
- returns success JSON plus an execution command if the action is safe and confirmed

## Safety model

- one operation only: `set-user-use-reserve-as-collateral`
- one asset path only: `sBTC / zS BTC`
- blocks low-gas execution
- blocks empty-position execution
- requires explicit `--confirm`
- no feature creep into borrow / supply / withdraw / routing

## Why this is competition-fit

The field already has strong yield, LP, and monitoring submissions. This PR takes a different angle: one small but real failure point on a live protocol path, turned into a direct execution primitive with proof, refusal logic, and exact structured output.

## Local verification

Ran successfully:

```bash
bun run skills/zest-collateral-toggle-executor/zest-collateral-toggle-executor.ts doctor --address SP4DXVEC16FS6QR7RBKGWZYJKTXPC81W49W0ATJE
bun run skills/zest-collateral-toggle-executor/zest-collateral-toggle-executor.ts run --address SP4DXVEC16FS6QR7RBKGWZYJKTXPC81W49W0ATJE --enable true
bun run skills/zest-collateral-toggle-executor/zest-collateral-toggle-executor.ts run --address SP4DXVEC16FS6QR7RBKGWZYJKTXPC81W49W0ATJE --enable true --confirm
```

The second command refuses correctly with `CONFIRM_REQUIRED`. The third returns `status: success` and emits the exact `call_contract` execution command.
