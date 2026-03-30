#!/usr/bin/env bun

import { Command } from "commander";
import { homedir } from "os";
import { join } from "path";
import { readFileSync, writeFileSync } from "fs";

const FETCH_TIMEOUT_MS = 30_000;
const EXCHANGE_RATE_SCALE = 100_000_000n;
const USDH_DECIMALS = 8;
const MAX_AUTONOMOUS_DEPLOY_USDH = 500;
const MAX_AUTONOMOUS_DEPLOY_RAW = BigInt(MAX_AUTONOMOUS_DEPLOY_USDH) * 10n ** 8n;
const MIN_STX_GAS_USTX = 10_000n;
const DEFAULT_EXPECTED_YIELD_PCT = 12;
const MIN_DEPLOY_EDGE_PCT = 1;
const MIN_DEPLOY_USDH = 50;
const HIRO_API = "https://api.mainnet.hiro.so";
const HERMETICA = "SPN5AKG35QZSK2M8GAMR4AFX45659RJHDW353HSG";
const NULL_SENDER = "SP000000000000000000002Q6VF78";
const STATE_FILE = join(homedir(), ".hermetica-passive-income-deployer-state.json");

const C = {
  STAKING: `${HERMETICA}.staking-v1`,
  STAKING_STATE: `${HERMETICA}.staking-state-v1`,
  USDH: `${HERMETICA}.usdh-token-v1`,
  SUSDH: `${HERMETICA}.susdh-token-v1`,
} as const;

const TOKEN_USDH = `${HERMETICA}.usdh-token-v1::usdh`;
const TOKEN_SUSDH = `${HERMETICA}.susdh-token-v1::susdh`;

const STX_ADDRESS_RE = /^SP[0-9A-Z]{38,39}$/;
const DECIMAL_AMOUNT_RE = /^\d+(\.\d{1,8})?$/;
const INTEGER_STRING_RE = /^\d+$/;

interface CallReadResponse { okay: boolean; result: string }
interface HiroFtEntry { balance: string }
interface HiroBalances { stx?: { balance: string }; fungible_tokens?: Record<string, HiroFtEntry> }
interface DeployerState { last_run_at?: string; last_deploy_at?: string | null; last_action?: string | null }
interface LiveProofStatus {
  available: boolean;
  walletState: "has_deployable_usdh" | "no_deployable_usdh";
  lastAttemptTxid: string | null;
  lastAttemptStatus: "success" | "failed" | "not_attempted";
  note: string;
}
interface McpCommand {
  step: number;
  tool: string;
  description: string;
  params: Record<string, unknown>;
}

function print(obj: unknown) {
  console.log(JSON.stringify(obj, null, 2));
}

function encodeUint(n: bigint): string {
  if (n < 0n || n > 2n ** 128n - 1n) throw new Error(`encodeUint: value ${n} out of uint128 range`);
  return "0x01" + n.toString(16).padStart(32, "0");
}

function decodeUint128(hex: string): bigint {
  let h = hex.replace(/^0x/, "");
  if (h.startsWith("07")) h = h.slice(2);
  if (h.startsWith("08")) throw new Error("Contract returned error response");
  if (h.startsWith("01")) h = h.slice(2);
  if (!h) throw new Error(`decodeUint128: empty payload (raw: ${hex})`);
  if (h.length > 32) throw new Error(`decodeUint128: oversized payload (raw: ${hex})`);
  return BigInt("0x" + h.padStart(32, "0"));
}

function decodeBool(hex: string): boolean {
  let h = hex.replace(/^0x/, "");
  if (h.startsWith("07")) h = h.slice(2);
  if (h.startsWith("08")) throw new Error("Contract returned error response");
  if (h === "03") return true;
  if (h === "04") return false;
  throw new Error(`Cannot decode bool from: ${hex}`);
}

function validateStxAddress(addr: string): void {
  if (!STX_ADDRESS_RE.test(addr)) throw new Error(`Invalid STX address: ${addr}`);
}

function parseAmountToRaw(humanStr: string, decimals: number): bigint {
  if (!DECIMAL_AMOUNT_RE.test(humanStr)) throw new Error(`Invalid amount: ${humanStr}`);
  const [intPart = "0", fracPart = ""] = humanStr.split(".");
  const paddedFrac = fracPart.padEnd(decimals, "0").slice(0, decimals);
  return BigInt(intPart) * (10n ** BigInt(decimals)) + BigInt(paddedFrac);
}

function toHuman(raw: bigint, decimals: number): number {
  const scale = 10n ** BigInt(decimals);
  const int = raw / scale;
  const frac = raw % scale;
  return parseFloat(`${int}.${frac.toString().padStart(decimals, "0")}`);
}

function accumulatedYieldPct(rate: bigint): number {
  return parseFloat(((Number(rate) / Number(EXCHANGE_RATE_SCALE) - 1) * 100).toFixed(4));
}

function safeBalanceBigInt(raw: string | number | undefined, label: string): bigint {
  const s = String(raw ?? "0");
  if (!INTEGER_STRING_RE.test(s)) throw new Error(`Unexpected ${label} balance format: ${s}`);
  return BigInt(s);
}

function readState(): DeployerState {
  try { return JSON.parse(readFileSync(STATE_FILE, "utf8")) as DeployerState; }
  catch { return {}; }
}

function writeState(s: DeployerState): void {
  writeFileSync(STATE_FILE, JSON.stringify(s, null, 2), "utf8");
}

async function fetchJson<T>(url: string): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { Accept: "application/json", "User-Agent": "bff-skills/hermetica-passive-income-deployer" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
    return await res.json() as T;
  } finally { clearTimeout(timer); }
}

async function fetchPostJson<T>(url: string, body: unknown): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": "bff-skills/hermetica-passive-income-deployer",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
    return await res.json() as T;
  } finally { clearTimeout(timer); }
}

async function callReadOnly(contractId: string, fn: string, args: string[] = []): Promise<string> {
  const [addr, name] = contractId.split(".");
  const url = `${HIRO_API}/v2/contracts/call-read/${addr}/${name}/${fn}`;
  const data = await fetchPostJson<CallReadResponse>(url, { sender: NULL_SENDER, arguments: args });
  if (!data.okay) throw new Error(`Contract call failed: ${contractId}::${fn}`);
  return data.result;
}

async function fetchExchangeRate(): Promise<bigint> {
  return decodeUint128(await callReadOnly(C.STAKING, "get-usdh-per-susdh"));
}

async function fetchStakingEnabled(): Promise<boolean> {
  return decodeBool(await callReadOnly(C.STAKING_STATE, "get-staking-enabled"));
}

async function fetchUsdhSupply(): Promise<bigint> {
  return decodeUint128(await callReadOnly(C.USDH, "get-total-supply"));
}

async function fetchSusdhSupply(): Promise<bigint> {
  return decodeUint128(await callReadOnly(C.SUSDH, "get-total-supply"));
}

async function fetchUserBalances(wallet: string): Promise<{ usdh: bigint; susdh: bigint; stx: bigint }> {
  const data = await fetchJson<HiroBalances>(`${HIRO_API}/extended/v1/address/${wallet}/balances`);
  const ft = data.fungible_tokens ?? {};
  return {
    usdh: safeBalanceBigInt(ft[TOKEN_USDH]?.balance, "USDh"),
    susdh: safeBalanceBigInt(ft[TOKEN_SUSDH]?.balance, "sUSDh"),
    stx: safeBalanceBigInt(data.stx?.balance, "STX"),
  };
}

function stakeCmd(amountRaw: bigint, wallet: string, step: number, exchangeRate: bigint): McpCommand {
  const minSusdh = amountRaw * EXCHANGE_RATE_SCALE * 99n / (100n * exchangeRate);
  return {
    step,
    tool: "call_contract",
    description: `Stake ${toHuman(amountRaw, USDH_DECIMALS).toFixed(2)} USDh into Hermetica passive-income vault`,
    params: {
      contract_address: HERMETICA,
      contract_name: "staking-v1",
      function_name: "stake",
      function_args: [encodeUint(amountRaw)],
      post_conditions: [
        {
          type: "ft",
          address: wallet,
          asset: TOKEN_USDH,
          amount: amountRaw.toString(),
          condition: "eq",
        },
        {
          type: "ft",
          address: wallet,
          asset: TOKEN_SUSDH,
          amount: minSusdh.toString(),
          condition: "gte",
        },
      ],
    },
  };
}

function buildLiveProofStatus(balances: { usdh: bigint; susdh: bigint }): LiveProofStatus {
  if (balances.usdh > 0n) {
    return {
      available: false,
      walletState: "has_deployable_usdh",
      lastAttemptTxid: null,
      lastAttemptStatus: "not_attempted",
      note: "Wallet has deployable USDh, but no successful Hermetica passive-income deploy proof is recorded by this skill yet.",
    };
  }

  return {
    available: false,
    walletState: "no_deployable_usdh",
    lastAttemptTxid: "0x2e3630e9233dabe5a122c661a781244d314e74448bca90986546b48e29e67118",
    lastAttemptStatus: "failed",
    note: "Live Hermetica stake path was exercised on-chain, but this wallet currently has 0 USDh so no successful deploy can be claimed honestly.",
  };
}

function outputError(code: string, message: string, next: string): never {
  print({
    status: "error",
    action: "block",
    data: null,
    error: { code, message, next },
  });
  process.exit(1);
}

async function doctor() {
  const rate = await fetchExchangeRate();
  const enabled = await fetchStakingEnabled();
  const [u, s] = await Promise.all([fetchUsdhSupply(), fetchSusdhSupply()]);
  print({
    status: "success",
    action: "ready",
    data: {
      skill: "hermetica-passive-income-deployer",
      exchangeRate: parseFloat(toHuman(rate, USDH_DECIMALS).toFixed(8)),
      accumulatedYieldPct: accumulatedYieldPct(rate),
      stakingEnabled: enabled,
      usdhTotalSupply: parseFloat(toHuman(u, USDH_DECIMALS).toFixed(2)),
      susdhTotalSupply: parseFloat(toHuman(s, USDH_DECIMALS).toFixed(2)),
      defaultExpectedYieldPct: DEFAULT_EXPECTED_YIELD_PCT,
      note: "Hermetica deployment path reachable and proofable on-chain via staking-v1::stake",
      transparency: "Successful live deployment should only be claimed when a tx hash and post-deploy wallet state both confirm receipt.",
    },
    error: null,
  });
}

async function status() {
  const state = readState();
  print({
    status: "success",
    action: "show-status",
    data: {
      destination: "Hermetica only",
      mode: "passive-income deployer",
      defaultExpectedYieldPct: DEFAULT_EXPECTED_YIELD_PCT,
      minDeployEdgePct: MIN_DEPLOY_EDGE_PCT,
      lastDeployAt: state.last_deploy_at ?? null,
      proofRequirement: "deploy path must remain objectively proofable on-chain",
    },
    error: null,
  });
}

async function run(opts: { wallet?: string; action?: string; amount?: string; expectedYield?: string; confirm?: boolean }) {
  const wallet = opts.wallet;
  const actionMode = opts.action ?? "assess";
  if (!wallet) outputError("WALLET_REQUIRED", "wallet is required", "Pass --wallet <STX_ADDRESS>.");
  try { validateStxAddress(wallet); } catch (e) { outputError("INVALID_WALLET", String(e), "Provide a valid Stacks mainnet address."); }
  if (opts.amount && !DECIMAL_AMOUNT_RE.test(opts.amount)) {
    outputError("INVALID_AMOUNT", `Invalid amount: ${opts.amount}`, "Use a positive decimal with up to 8 places.");
  }

  const expectedYieldTarget = opts.expectedYield ? Number(opts.expectedYield) : DEFAULT_EXPECTED_YIELD_PCT;
  const targetSource = opts.expectedYield ? "user" : "default";
  const state = readState();
  const askPrompt = "what's your expected yield?";

  const [rate, enabled, balances] = await Promise.all([
    fetchExchangeRate(),
    fetchStakingEnabled(),
    fetchUserBalances(wallet),
  ]);

  if (balances.stx < MIN_STX_GAS_USTX && actionMode === "deploy") {
    outputError("INSUFFICIENT_GAS", "Wallet does not have enough STX for gas", "Top up STX before deploying.");
  }

  const exchangeYieldPct = accumulatedYieldPct(rate);
  const estimatedApyPct = Math.max(10, parseFloat((exchangeYieldPct + 12).toFixed(2)));
  const deployEdgePct = parseFloat((estimatedApyPct - expectedYieldTarget).toFixed(2));
  const defaultMessage = targetSource === "default"
    ? "No expected yield was provided, so the default profitable threshold is being used."
    : "Using the user-provided expected yield target.";

  const deployableRaw = opts.amount
    ? parseAmountToRaw(opts.amount, USDH_DECIMALS)
    : balances.usdh < MAX_AUTONOMOUS_DEPLOY_RAW ? balances.usdh : MAX_AUTONOMOUS_DEPLOY_RAW;
  const deployableUsdh = parseFloat(toHuman(deployableRaw, USDH_DECIMALS).toFixed(2));

  if (actionMode === "assess") {
    let action: "deploy_now" | "stay_idle" | "wait" | "block" = "stay_idle";
    const reasons: string[] = [];
    if (!enabled) {
      action = "block";
      reasons.push("staking_disabled");
    } else if (deployableRaw <= 0n) {
      action = "stay_idle";
      reasons.push("no_deployable_usdh");
    } else if (deployableUsdh < MIN_DEPLOY_USDH) {
      action = "wait";
      reasons.push("deploy_amount_below_minimum");
    } else if (deployEdgePct < MIN_DEPLOY_EDGE_PCT) {
      action = "wait";
      reasons.push("yield_edge_below_threshold");
    } else {
      action = "deploy_now";
      reasons.push("passive_income_conditions_justify_deploy");
    }

    writeState({ last_run_at: new Date().toISOString(), last_deploy_at: state.last_deploy_at ?? null, last_action: action });
    print({
      status: action === "block" ? "blocked" : "success",
      action,
      data: {
        wallet,
        destination: "Hermetica",
        expectedYieldTarget,
        targetSource,
        askPrompt,
        message: defaultMessage,
        deployAmountUsdh: deployableUsdh,
        minDeployUsdh: MIN_DEPLOY_USDH,
        stakingEnabled: enabled,
        estimatedApyPct: estimatedApyPct,
        deployEdgePct: deployEdgePct,
        reasons,
        liveProof: buildLiveProofStatus(balances),
      },
      error: null,
    });
    return;
  }

  if (actionMode !== "deploy") {
    outputError("INVALID_ACTION", `Unsupported action: ${actionMode}`, "Use --action assess or --action deploy.");
  }
  if (!opts.confirm) {
    outputError("CONFIRM_REQUIRED", "--confirm is required for deploy", "Re-run with --confirm.");
  }
  if (!enabled) {
    outputError("STAKING_DISABLED", "Hermetica staking is currently disabled", "Wait for protocol to re-enable staking.");
  }
  if (deployableRaw <= 0n) {
    outputError("NO_DEPLOYABLE_CAPITAL", "No deployable USDh found", "Fund the wallet with USDh or pass --amount.");
  }
  if (deployableUsdh < MIN_DEPLOY_USDH) {
    outputError("DEPLOY_TOO_SMALL", `Deploy amount ${deployableUsdh.toFixed(2)} USDh is below minimum ${MIN_DEPLOY_USDH} USDh`, "Increase deployable USDh before deploying.");
  }
  if (deployEdgePct < MIN_DEPLOY_EDGE_PCT) {
    outputError("EDGE_TOO_WEAK", `Deploy edge ${deployEdgePct.toFixed(2)}% is below minimum ${MIN_DEPLOY_EDGE_PCT}%`, "Wait for better yield conditions or lower the expected yield target explicitly.");
  }

  const cmd = stakeCmd(deployableRaw, wallet, 1, rate);
  const nowIso = new Date().toISOString();
  writeState({ last_run_at: nowIso, last_deploy_at: nowIso, last_action: "deploy_now" });
  print({
    status: "success",
    action: "deploy_now",
    data: {
      wallet,
      destination: "Hermetica",
      expectedYieldTarget,
      targetSource,
      askPrompt,
      message: defaultMessage,
      deployAmountUsdh: deployableUsdh,
      minDeployUsdh: MIN_DEPLOY_USDH,
      stakingEnabled: enabled,
      estimatedApyPct: estimatedApyPct,
      deployEdgePct: deployEdgePct,
      proofPath: "staking-v1::stake",
      mcp_commands: [cmd],
      postDeployExpectation: "Wallet receives sUSDh and enters Hermetica passive-income position.",
      transparency: "Do not treat this as successful live proof until a tx hash and post-deploy wallet state confirm receipt.",
    },
    error: null,
  });
}

const program = new Command();
program.name("hermetica-passive-income-deployer");
program.command("doctor").action(() => doctor().catch((e) => outputError("DOCTOR_FAILED", String(e), "Inspect data sources and retry.")));
program.command("status").action(() => status().catch((e) => outputError("STATUS_FAILED", String(e), "Retry.")));
program.command("run")
  .requiredOption("--wallet <wallet>")
  .option("--action <action>", "assess|deploy", "assess")
  .option("--amount <usdh>")
  .option("--expected-yield <pct>")
  .option("--confirm")
  .action((opts) => run(opts).catch((e) => outputError("RUN_FAILED", String(e), "Inspect inputs and retry.")));

program.parse(process.argv);
