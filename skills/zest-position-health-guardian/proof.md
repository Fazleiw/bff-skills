# Proof — Zest Position Health Guardian

## Live smoke test
Wallet used for read-only verification:
- `SP137SY7VWJFMVBF9GMCSQ2GETC1FV5FYZVKXSMJ8`

### doctor
Command:
```bash
STX_ADDRESS=SP137SY7VWJFMVBF9GMCSQ2GETC1FV5FYZVKXSMJ8 bun run skills/zest-position-health-guardian/zest-position-health-guardian.ts doctor
```

Observed result:
```json
{
  "status": "success",
  "action": "Ready to read Zest position health",
  "data": {
    "address": "SP137SY7VWJFMVBF9GMCSQ2GETC1FV5FYZVKXSMJ8",
    "stx_ustx": 3032189,
    "probe_position": {
      "supplied": 0,
      "borrowed": 0
    }
  },
  "error": null
}
```

### status --asset sBTC
Command:
```bash
STX_ADDRESS=SP137SY7VWJFMVBF9GMCSQ2GETC1FV5FYZVKXSMJ8 bun run skills/zest-position-health-guardian/zest-position-health-guardian.ts status --asset sBTC
```

Observed result:
```json
{
  "status": "success",
  "action": "Position healthy - safe to keep current capital state",
  "data": {
    "classification": "HEALTHY",
    "address": "SP137SY7VWJFMVBF9GMCSQ2GETC1FV5FYZVKXSMJ8",
    "asset": "sBTC",
    "supplied": "0",
    "borrowed": "0",
    "health_ratio_bps": 99999,
    "thresholds": {
      "min_health_ratio_bps": 15000,
      "max_utilization_bps": 9000
    },
    "raw_position": null
  },
  "error": null
}
```

## Proof interpretation
This is read-only proof, not an on-chain write proof. The skill's purpose is to produce a machine-routable position-health decision from live Zest state, not to broadcast funds. The evidence above proves:
- command runs in the BFF repo context
- Zest read path is live
- output contract is structured and deterministic
- the skill can classify a real address/asset pair without hidden dependencies
