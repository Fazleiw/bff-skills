#!/usr/bin/env bun
/**
 * hodlmm-idle-liquidity-recover — Single-purpose idle liquidity rescue for HODLMM.
 *
 * Narrower than full rebalancers: detect out-of-range bins, preview a single move,
 * and execute one controlled rescue transaction when explicitly confirmed.
 */
import { Command } from "commander";

function out(status: string, action: string, data: unknown, error: string | null = null) {
  console.log(JSON.stringify({ status, action, data, error }));
}

const program = new Command();
program.name("hodlmm-idle-liquidity-recover");

program.command("doctor").action(() => {
  out("success", "doctor", {
    ready: true,
    mode: "scaffold",
    primitive: "single_pool_idle_liquidity_recovery",
    write_path: "move-relative-liquidity-multi",
    confirm_required: true,
  });
});

program.command("scan").action(() => {
  out("success", "scan", {
    mode: "scaffold",
    pools_scanned: 0,
    positions_found: 0,
    out_of_range: 0,
    recommendation: "Wire live pool scan and wallet positions before production use",
  });
});

program.command("plan").requiredOption("--pool <pool>").action((opts) => {
  out("success", "plan", {
    mode: "scaffold",
    pool: opts.pool,
    decision: "MOVE_NEEDED",
    action: "single_rescue_move",
    atomic: true,
    contract_call: "move-relative-liquidity-multi",
    reason: "Idle liquidity rescue is scoped to one explicit move, not full active management",
  });
});

program.command("run").requiredOption("--pool <pool>").option("--confirm", "broadcast transaction").action((opts) => {
  if (!opts.confirm) {
    out("success", "run", {
      mode: "dry-run",
      pool: opts.pool,
      decision: "CONFIRM_REQUIRED",
      contract_call: "move-relative-liquidity-multi",
      reason: "Add --confirm to execute one rescue move",
    });
    return;
  }
  out("error", "run", { pool: opts.pool }, "Live write path not yet wired in scaffold version");
  process.exit(1);
});

program.parse(process.argv);
