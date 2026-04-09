---
name: hodlmm-idle-liquidity-recover
skill: hodlmm-idle-liquidity-recover
description: Rescue idle HODLMM liquidity back into earning range with one controlled write.
---

## Decision order
1. Verify HODLMM APIs and wallet access.
2. Refuse write execution unless a position is out of range or `--force` is provided.
3. Generate a single rescue plan before any transaction.
4. Require `--confirm` before broadcasting.
5. Return JSON only.
