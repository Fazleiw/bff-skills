#!/usr/bin/env bun
import { Command } from "commander";

function out(status: string, action: string, data: unknown, error: string | null = null) {
  console.log(JSON.stringify({ status, action, data, error }));
}

const program = new Command();
program.name("hodlmm-idle-liquidity-recover");

program
  .command("doctor")
  .action(() => {
    out("success", "doctor", {
      ready: true,
      mode: "scaffold",
      note: "Skill scaffold prepared for BFF competition differentiation against move/rebalance competitors.",
      primitive: "single_pool_idle_liquidity_recovery"
    });
  });

program
  .command("scan")
  .action(() => {
    out("success", "scan", {
      mode: "scaffold",
      positions_found: 0,
      recommendation: "Implement live pool scan before production use"
    });
  });

program
  .command("plan")
  .requiredOption("--pool <pool>")
  .action((opts) => {
    out("success", "plan", {
      mode: "scaffold",
      pool: opts.pool,
      action: "single_rescue_move",
      atomic: true,
      contract_call: "move-relative-liquidity-multi"
    });
  });

program
  .command("run")
  .requiredOption("--pool <pool>")
  .option("--confirm", "broadcast transaction")
  .action((opts) => {
    if (!opts.confirm) {
      out("success", "run", {
        mode: "dry-run",
        pool: opts.pool,
        decision: "CONFIRM_REQUIRED",
        contract_call: "move-relative-liquidity-multi"
      });
      return;
    }
    out("error", "run", { pool: opts.pool }, "Live write path not yet wired in scaffold version");
    process.exit(1);
  });

program.parse(process.argv);
