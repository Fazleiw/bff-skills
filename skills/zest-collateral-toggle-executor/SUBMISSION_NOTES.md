# Submission Notes — zest-collateral-toggle-executor

## One-line pitch
A direct, fail-closed execution primitive for one fragile Zest helper action: enabling or disabling collateral on a live sBTC position.

## Why this should win
- **Narrow**: one function, one asset path, one exact operational question.
- **Production-real**: built from a wallet with one successful collateral toggle and three aborted attempts on the same helper path.
- **Write-capable feel**: with `--confirm`, the skill emits the exact execution command instead of stopping at advisory output.
- **Safety enforced in code**: blocks low gas, no position, and unconfirmed actions.
- **Reviewer clarity**: the use case is understandable in under 30 seconds.

## Best proof to point at
- success tx: `0xc9ca5d55f71db8e1ec482e9bff6161f2ad0b1cda9554516e3efa00a817ebd7a9`
- latest abort: `0xb5fbb202a8daa478435097343d8dce0ef81d4615c409d5a3b1b094c1abe73696`
- live wallet balances observed during build
- smoke-tested refusal path and success path

## What not to overclaim
- do not claim this wrapper itself already broadcast a transaction
- do not claim borrow / supply / withdraw support
- do not claim broad risk management or portfolio automation

## Best reviewer framing
"This closes one small but real production loop: turning a failure-prone collateral helper call into a direct execution primitive with hard refusal logic."
