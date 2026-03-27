#!/usr/bin/env bun

type Policy = {
  strategy_id: string;
  executor: string;
  executor_stx: string;
  policy_version: number;
  expiry_block: number;
  allowed_protocols: string[];
  allowed_actions: string[];
  allocation: {
    max_total_bps: number;
    max_single_action_bps: number;
  };
  state_machine: {
    initial: string;
    allowed_transitions: Record<string, string[]>;
  };
  constraints: {
    allowed_pairs: string[];
    slippage_bps_max: number;
    require_strategy_reference: boolean;
  };
  metadata: {
    intent: string;
    created_at: string;
  };
};

function out(payload: any, code = 0) {
  console.log(JSON.stringify(payload, null, 2));
  process.exit(code);
}

function canonicalize(value: any): any {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((acc: any, key) => {
      acc[key] = canonicalize(value[key]);
      return acc;
    }, {});
  }
  return value;
}

async function sha256Hex(input: string) {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function defaultPolicy(): Policy {
  return {
    strategy_id: `iw-${Date.now()}`,
    executor: 'inner-whale',
    executor_stx: 'SP137SY7VWJFMVBF9GMCSQ2GETC1FV5FYZVKXSMJ8',
    policy_version: 1,
    expiry_block: 110000,
    allowed_protocols: ['bitflow', 'hodlmm'],
    allowed_actions: ['swap', 'add_liquidity', 'remove_liquidity', 'withdraw'],
    allocation: {
      max_total_bps: 2000,
      max_single_action_bps: 1000
    },
    state_machine: {
      initial: 'committed',
      allowed_transitions: {
        committed: ['entered', 'cancelled'],
        entered: ['managing', 'exiting', 'cancelled'],
        managing: ['exiting', 'completed', 'cancelled'],
        exiting: ['completed', 'cancelled']
      }
    },
    constraints: {
      allowed_pairs: ['sBTC-STX', 'STX-USDCx'],
      slippage_bps_max: 100,
      require_strategy_reference: true
    },
    metadata: {
      intent: 'Rotate limited BTC exposure into a HODLMM/Bitflow LP strategy under committed policy constraints.',
      created_at: new Date().toISOString()
    }
  };
}

async function main() {
  const command = process.argv[2];
  if (command === 'doctor') {
    out({
      status: 'success',
      action: 'Policy compiler ready.',
      data: {
        commands: ['doctor', 'run'],
        executor: 'inner-whale',
        protocols: ['bitflow', 'hodlmm']
      },
      error: null
    });
  }

  if (command === 'run') {
    const policy = defaultPolicy();
    const canonical = JSON.stringify(canonicalize(policy));
    const policy_hash = await sha256Hex(canonical);
    out({
      status: 'success',
      action: 'Policy compiled and hashed.',
      data: {
        policy,
        canonical_policy_json: canonical,
        policy_hash
      },
      error: null
    });
  }

  out({
    status: 'error',
    action: 'Use doctor or run.',
    data: { receivedCommand: command || null },
    error: { code: 'INVALID_COMMAND', message: 'Supported commands are doctor and run.', next: 'Run doctor first, then run.' }
  }, 1);
}

main();
