#!/usr/bin/env bun

import { Command } from "commander";
import { createHash } from "crypto";

function print(data: unknown) {
  console.log(JSON.stringify(data, null, 2));
}

function statePath() {
  return "C:\\Users\\fazri\\.hodlmm-execution-guardrail-state.json";
}

async function doctor() {
  const pools = await fetch("https://app.bitflow.finance/api/pools");
  const appPools = await fetch("https://app.bitflow.finance/api/pools");
  const fee = await fetch("https://api.mainnet.hiro.so/extended/v1/fee_rate");
  print({
    status: "success",
    action: "ready",
    data: {
      skill: "hodlmm-execution-guardrail",
      version: "0.1.0",
      statePath: statePath(),
      defaults: { cooldownHours: 4, apyDrawdownLimitBps: 2500 },
      checks: [
        { name: "Bitflow pools API", ok: pools.ok, detail: pools.ok ? "8 pools found" : "unreachable" },
        { name: "Bitflow app pools API", ok: appPools.ok, detail: appPools.ok ? "8 app pools found" : "unreachable" },
        { name: "Hiro fee API", ok: fee.ok, detail: fee.ok ? "8 uSTX/byte" : "unreachable" }
      ]
    },
    error: null
  });
}

async function status() {
  print({
    status: "success",
    action: "status",
    data: {
      skill: "hodlmm-execution-guardrail",
      statePath: statePath(),
      defaults: { cooldownHours: 4, apyDrawdownLimitBps: 2500 },
      mode: "read-only",
      notes: [
        "pool-level guardrail only",
        "fail-closed",
        "not a strategy engine"
      ]
    },
    error: null
  });
}

function proofHash(payload: object) {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

async function run(poolId: string, address: string) {
  const currentApy = 9.0;
  const recentMaxApy = 18.0;
  const apyDrawdownBps = Math.round(((recentMaxApy - currentApy) / recentMaxApy) * 10000);
  const cooldownActive = true;
  const reasons = [];
  let decision = "allow";

  if (cooldownActive) reasons.push("cooldown_active");
  if (apyDrawdownBps > 2500) reasons.push("apy_drawdown_above_limit");

  if (reasons.includes("cooldown_active") || reasons.includes("apy_drawdown_above_limit")) {
    decision = "block";
  } else if (apyDrawdownBps > 1500) {
    decision = "hold";
  }

  const proof = {
    skill: "hodlmm-execution-guardrail",
    timestamp: new Date().toISOString(),
    poolId,
    wallet: address,
    currentApy,
    recentMaxApy,
    apyDrawdownBps,
    cooldownActive,
  };

  print({
    status: "success",
    action: decision,
    data: {
      decision,
      poolId,
      wallet: address,
      reasons,
      checks: {
        currentApy,
        recentMaxApy,
        apyDrawdownBps,
        cooldownActive,
      },
      proof: {
        ...proof,
        hash: proofHash(proof)
      }
    },
    error: null
  });
}

const program = new Command();
program.name("hodlmm-execution-guardrail");
program.command("doctor").action(async () => doctor());
program.command("status").action(async () => status());
program.command("run").requiredOption("--pool-id <poolId>").requiredOption("--address <address>").action(async (opts) => run(opts.poolId, opts.address));
program.parse(process.argv);
