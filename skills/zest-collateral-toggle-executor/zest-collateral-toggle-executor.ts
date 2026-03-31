#!/usr/bin/env bun
import { Command } from "commander";
import { execFileSync } from "child_process";

const HIRO_API = "https://api.hiro.so";
const NETWORK = "mainnet";
const MIN_STX_GAS_USTX = 150_000;
const BORROW_HELPER = "SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.borrow-helper-v2-1-7";
const ZSBTC = "SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.zsbtc-v2-0";
const SBTC = "SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token";
const ORACLE = "SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.stx-btc-oracle-v1-4";

function print(data: unknown): void {
  console.log(JSON.stringify(data, null, 2));
}

function outputError(code: string, message: string, next: string): never {
  print({
    status: "error",
    action: `Blocked: ${message}`,
    data: null,
    error: { code, message, next },
  });
  process.exit(1);
}

function fetchJsonViaPowerShell<T>(url: string): T {
  const script = `$ProgressPreference='SilentlyContinue'; (Invoke-WebRequest -Uri '${url}' -UseBasicParsing -TimeoutSec 20).Content`;
  const raw = execFileSync("powershell", ["-NoProfile", "-Command", script], { encoding: "utf8" });
  return JSON.parse(raw) as T;
}

async function getBalances(stxAddress: string): Promise<{ stxUstx: number; sbtcSats: number; zsbtcSats: number }> {
  const data = fetchJsonViaPowerShell<any>(`${HIRO_API}/extended/v1/address/${stxAddress}/balances`);
  const fungible = data?.fungible_tokens ?? {};
  return {
    stxUstx: Number(data?.stx?.balance ?? 0),
    sbtcSats: Number(fungible["SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token::sbtc-token"]?.balance ?? 0),
    zsbtcSats: Number(fungible["SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.zsbtc-token::zsbtc"]?.balance ?? 0),
  };
}

async function getTransactions(stxAddress: string): Promise<any[]> {
  const data = fetchJsonViaPowerShell<any>(`${HIRO_API}/extended/v1/address/${stxAddress}/transactions?limit=50`);
  return data?.results ?? [];
}

function analyseCollateralToggleHistory(txs: any[]): { successCount: number; abortCount: number; latestSuccess: any | null; latestAbort: any | null } {
  const relevant = txs.filter((tx) => tx?.contract_call?.function_name === "set-user-use-reserve-as-collateral");
  const success = relevant.filter((tx) => tx?.tx_status === "success");
  const aborts = relevant.filter((tx) => String(tx?.tx_status ?? "").startsWith("abort"));
  return {
    successCount: success.length,
    abortCount: aborts.length,
    latestSuccess: success[0] ?? null,
    latestAbort: aborts[0] ?? null,
  };
}

function buildDecision(enableAsCollateral: boolean, stxUstx: number, zsbtcSats: number) {
  if (stxUstx < MIN_STX_GAS_USTX) {
    return {
      allowed: false,
      status: "blocked_gas",
      reason: `STX gas ${stxUstx} < minimum ${MIN_STX_GAS_USTX}`,
      executionReady: false,
    };
  }
  if (zsbtcSats <= 0) {
    return {
      allowed: false,
      status: "blocked_no_position",
      reason: "Wallet has no zS BTC position, so collateral toggle would be meaningless",
      executionReady: false,
    };
  }
  return {
    allowed: true,
    status: "ready",
    reason: enableAsCollateral
      ? "Wallet has zS BTC and enough STX gas to enable collateral"
      : "Wallet has zS BTC and enough STX gas to disable collateral",
    executionReady: true,
  };
}

function mcpCommand(address: string, enableAsCollateral: boolean) {
  return {
    step: 1,
    tool: "call_contract",
    description: enableAsCollateral
      ? "Enable Zest sBTC collateral on the live zS BTC position"
      : "Disable Zest sBTC collateral on the live zS BTC position",
    params: {
      contract: BORROW_HELPER,
      function: "set-user-use-reserve-as-collateral",
      wallet: address,
      lpToken: ZSBTC,
      asset: SBTC,
      oracle: ORACLE,
      enableAsCollateral,
      note: "Use current oracle bytes from the execution environment. This skill enforces whether execution should proceed and emits the exact intended helper call.",
    },
  };
}

const program = new Command();
program.name("zest-collateral-toggle-executor").description("Direct executor for one narrow Zest sBTC collateral toggle path");

program
  .command("doctor")
  .requiredOption("--address <stxAddress>", "Stacks address to inspect")
  .action(async (opts) => {
    const balances = await getBalances(opts.address);
    const txs = await getTransactions(opts.address);
    const proof = analyseCollateralToggleHistory(txs);
    print({
      status: "ok",
      action: "READY",
      data: {
        network: NETWORK,
        address: opts.address,
        contracts: {
          borrowHelper: BORROW_HELPER,
          lpToken: ZSBTC,
          asset: SBTC,
          oracle: ORACLE,
        },
        balances: {
          stxGasUstx: balances.stxUstx,
          walletSbtcSats: balances.sbtcSats,
          suppliedZsbtcSats: balances.zsbtcSats,
        },
        proof: {
          collateralToggleSuccessCount: proof.successCount,
          collateralToggleAbortCount: proof.abortCount,
          latestSuccessfulTxId: proof.latestSuccess?.tx_id ?? null,
          latestAbortTxId: proof.latestAbort?.tx_id ?? null,
          latestAbortCode: proof.latestAbort?.tx_result?.repr ?? null,
        },
      },
      error: null,
    });
  });

program
  .command("run")
  .requiredOption("--address <stxAddress>", "Stacks address to inspect")
  .requiredOption("--enable <true|false>", "Whether to enable or disable collateral")
  .option("--confirm", "Required for execution actions")
  .action(async (opts) => {
    const enable = String(opts.enable).toLowerCase() === "true";
    const balances = await getBalances(opts.address);
    const txs = await getTransactions(opts.address);
    const proof = analyseCollateralToggleHistory(txs);
    const decision = buildDecision(enable, balances.stxUstx, balances.zsbtcSats);

    if (!decision.allowed) {
      outputError(
        decision.status === "blocked_gas" ? "INSUFFICIENT_STX_GAS" : "NO_ZSBTC_POSITION",
        decision.reason,
        decision.status === "blocked_gas" ? "Top up STX gas and retry." : "Supply into Zest first or use the correct wallet."
      );
    }

    if (!opts.confirm) {
      outputError(
        "CONFIRM_REQUIRED",
        `--confirm required to ${enable ? "enable" : "disable"} collateral`,
        "Re-run with --confirm to emit the execution command."
      );
    }

    print({
      status: "success",
      action: enable ? "ENABLE_COLLATERAL" : "DISABLE_COLLATERAL",
      data: {
        network: NETWORK,
        address: opts.address,
        balances: {
          stxGasUstx: balances.stxUstx,
          walletSbtcSats: balances.sbtcSats,
          suppliedZsbtcSats: balances.zsbtcSats,
        },
        decision,
        mcp_commands: [mcpCommand(opts.address, enable)],
        proof: {
          collateralToggleSuccessCount: proof.successCount,
          collateralToggleAbortCount: proof.abortCount,
          latestSuccessfulTxId: proof.latestSuccess?.tx_id ?? null,
          latestAbortTxId: proof.latestAbort?.tx_id ?? null,
          latestAbortCode: proof.latestAbort?.tx_result?.repr ?? null,
        },
      },
      error: null,
    });
  });

program.parse(process.argv);
