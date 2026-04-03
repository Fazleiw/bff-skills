#!/usr/bin/env bun
/**
 * Zest Position Health Guardian — fail-closed read-only health gate for Zest positions
 */

import {
  principalCV,
  contractPrincipalCV,
  fetchCallReadOnlyFunction,
  cvToJSON,
} from "@stacks/transactions";
import { STACKS_MAINNET } from "@stacks/network";
import { Command } from "commander";

const NETWORK = STACKS_MAINNET;
const HIRO_API = "https://api.hiro.so";
const POOL_BORROW = "SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.pool-borrow-v2-3";
const SBTC_TOKEN = "SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token";
const DEFAULT_MIN_HEALTH_RATIO_BPS = 15000;
const DEFAULT_MAX_UTILIZATION_BPS = 9000;

function output(obj: unknown) {
  console.log(JSON.stringify(obj, null, 2));
}

function splitContractId(id: string): { address: string; name: string } {
  const [address, name] = id.split(".");
  return { address, name };
}

function getWalletAddress(explicit?: string): string {
  const addr = explicit || process.env.STACKS_ADDRESS || process.env.STX_ADDRESS;
  if (!addr) throw new Error("No wallet address found. Pass --address or set STACKS_ADDRESS/STX_ADDRESS.");
  return addr;
}

function ratioBps(supplied: bigint, borrowed: bigint): number {
  if (borrowed <= 0n) return 99999;
  if (supplied <= 0n) return 0;
  return Number((supplied * 10000n) / borrowed);
}

async function getStxBalance(address: string): Promise<number> {
  const res = await fetch(`${HIRO_API}/extended/v1/address/${address}/stx`);
  if (!res.ok) throw new Error(`Failed to fetch STX balance: ${res.status}`);
  const data = await res.json();
  return parseInt(data.balance, 10) - parseInt(data.locked, 10);
}

async function getZestPosition(address: string): Promise<{ supplied: number; borrowed: number; raw: any }> {
  const { address: poolAddr, name: poolName } = splitContractId(POOL_BORROW);
  const { address: sbtcAddr, name: sbtcName } = splitContractId(SBTC_TOKEN);

  try {
    const result = await fetchCallReadOnlyFunction({
      network: NETWORK,
      contractAddress: poolAddr,
      contractName: poolName,
      functionName: "get-user-reserve-data",
      functionArgs: [principalCV(address), contractPrincipalCV(sbtcAddr, sbtcName)],
      senderAddress: address,
    });

    const json = cvToJSON(result);
    if (json.success && json.value) {
      const val = json.value.value || json.value;
      return {
        supplied: parseInt(val["current-atoken-balance"]?.value || "0", 10),
        borrowed: parseInt(val["current-variable-debt"]?.value || "0", 10),
        raw: val,
      };
    }
    return { supplied: 0, borrowed: 0, raw: null };
  } catch {
    return { supplied: 0, borrowed: 0, raw: null };
  }
}

function classify(healthRatioBps: number, minHealthRatioBps: number) {
  if (healthRatioBps === 0) {
    return {
      cls: "BLOCKED",
      status: "blocked",
      action: "Do not assume this position is healthy for downstream capital decisions",
      error: {
        code: "no_effective_collateral",
        message: "Position has no effective collateral against borrow exposure",
        next: "Withdraw, repay, or reduce reuse assumptions before proceeding"
      }
    };
  }
  if (healthRatioBps < minHealthRatioBps) {
    return {
      cls: "BLOCKED",
      status: "blocked",
      action: "Do not assume this position is healthy for downstream capital decisions",
      error: {
        code: "health_below_threshold",
        message: "Position health ratio below configured minimum",
        next: "Withdraw, repay, or reduce reuse assumptions before proceeding"
      }
    };
  }
  if (healthRatioBps < Math.round(minHealthRatioBps * 1.25)) {
    return {
      cls: "WATCH",
      status: "success",
      action: "Watch position health - review before reusing capital",
      error: null
    };
  }
  return {
    cls: "HEALTHY",
    status: "success",
    action: "Position healthy - safe to keep current capital state",
    error: null
  };
}

async function doctor(addressArg?: string) {
  try {
    const address = getWalletAddress(addressArg);
    const stx = await getStxBalance(address);
    const pos = await getZestPosition(address);
    output({
      status: "success",
      action: "Ready to read Zest position health",
      data: {
        address,
        stx_ustx: stx,
        probe_position: { supplied: pos.supplied, borrowed: pos.borrowed }
      },
      error: null
    });
  } catch (error) {
    output({
      status: "blocked",
      action: "Fix wallet/address or network reachability before using this skill",
      data: {},
      error: {
        code: "doctor_failed",
        message: error instanceof Error ? error.message : String(error),
        next: "Pass --address or set STACKS_ADDRESS/STX_ADDRESS"
      }
    });
    process.exit(1);
  }
}

async function inspect(asset: string, addressArg: string | undefined, minHealthRatioBps: number, maxUtilizationBps: number) {
  try {
    const address = getWalletAddress(addressArg);
    const position = await getZestPosition(address);
    const supplied = BigInt(position.supplied);
    const borrowed = BigInt(position.borrowed);
    const healthRatio = ratioBps(supplied, borrowed);
    const verdict = classify(healthRatio, minHealthRatioBps);

    output({
      status: verdict.status,
      action: verdict.action,
      data: {
        classification: verdict.cls,
        address,
        asset,
        supplied: supplied.toString(),
        borrowed: borrowed.toString(),
        health_ratio_bps: healthRatio,
        thresholds: {
          min_health_ratio_bps: minHealthRatioBps,
          max_utilization_bps: maxUtilizationBps
        },
        raw_position: position.raw
      },
      error: verdict.error
    });

    if (verdict.status === "blocked") process.exit(2);
  } catch (error) {
    output({
      status: "blocked",
      action: "Do not proceed until position health can be read",
      data: {},
      error: {
        code: "position_read_failed",
        message: error instanceof Error ? error.message : String(error),
        next: "Retry later or verify asset/address input"
      }
    });
    process.exit(1);
  }
}

const program = new Command();
program.name("zest-position-health-guardian").description("Read-only health gate for Zest lending positions");

program.command("doctor")
  .option("--address <addr>", "Address to inspect")
  .action(async (opts) => { await doctor(opts.address); });

for (const cmd of ["status", "run"] as const) {
  program.command(cmd)
    .requiredOption("--asset <symbolOrContractId>", "Asset symbol or contract id, e.g. sBTC")
    .option("--address <addr>", "Address to inspect")
    .option("--min-health-ratio <bps>", "Minimum healthy ratio in basis points", String(DEFAULT_MIN_HEALTH_RATIO_BPS))
    .option("--max-utilization-bps <bps>", "Reserved threshold for future pool checks", String(DEFAULT_MAX_UTILIZATION_BPS))
    .action(async (opts) => {
      await inspect(opts.asset, opts.address, Number(opts.minHealthRatio), Number(opts.maxUtilizationBps));
    });
}

program.parseAsync().catch((error) => {
  output({
    status: "error",
    action: "Unhandled skill failure",
    data: {},
    error: {
      code: "unhandled",
      message: error instanceof Error ? error.message : String(error),
      next: "Inspect stack and rerun"
    }
  });
  process.exit(1);
});
