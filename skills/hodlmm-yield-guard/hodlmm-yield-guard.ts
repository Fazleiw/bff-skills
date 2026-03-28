#!/usr/bin/env node

const https = require('https');
const crypto = require('crypto');

const SKILL_NAME = 'hodlmm-yield-guard';
const SKILL_VERSION = '0.2.0';

function arg(name, fallback) {
  const idx = process.argv.indexOf(name);
  return idx >= 0 && process.argv[idx + 1] ? process.argv[idx + 1] : fallback;
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (err) {
          reject(new Error(`JSON parse failure for ${url}: ${err.message}`));
        }
      });
    }).on('error', (err) => reject(new Error(`HTTP failure for ${url}: ${err.message}`)));
  });
}

function decideYieldAction({ currentYield, bestYield, threshold, minDelta }) {
  if (currentYield < threshold && bestYield < threshold) return 'alert';
  if (currentYield < threshold) return 'rotate';
  if ((bestYield - currentYield) >= minDelta) return 'rotate';
  return 'stay';
}

function pickBestPool(pools, filter) {
  let bestKey = null;
  let bestYield = -Infinity;
  for (const [key, value] of Object.entries(pools)) {
    if (filter && !key.toLowerCase().includes(filter.toLowerCase())) continue;
    const apy = Number(value?.apy);
    if (Number.isFinite(apy) && apy > bestYield) {
      bestYield = apy;
      bestKey = key;
    }
  }
  return { bestKey, bestYield };
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

(async () => {
  try {
    const url = 'https://app.bitflow.finance/api/apy-v2';
    const currentPoolKey = arg('--current-pool', 'xyk-pool-sbtc-stx-v-1-1');
    const threshold = Number(arg('--threshold', '10'));
    const minDelta = Number(arg('--min-delta', '1'));
    const filter = arg('--filter', 'xyk-pool');
    const timestamp = new Date().toISOString();

    const payload = await fetchJson(url);
    const pools = payload?.data?.pools;
    if (!pools || typeof pools !== 'object') throw new Error('No pools object found in live APY payload');

    const currentPool = pools[currentPoolKey];
    if (!currentPool) throw new Error(`Current pool not found: ${currentPoolKey}`);

    const currentYield = Number(currentPool?.apy || 0);
    if (!Number.isFinite(currentYield)) throw new Error(`Invalid current yield for pool: ${currentPoolKey}`);

    const { bestKey, bestYield } = pickBestPool(pools, filter);
    if (!bestKey || !Number.isFinite(bestYield)) throw new Error(`No valid pool found for filter: ${filter}`);

    const action = decideYieldAction({ currentYield, bestYield, threshold, minDelta });
    const reason = action === 'alert'
      ? 'Current yield is below threshold and no filtered alternative clears the threshold.'
      : action === 'rotate'
      ? 'Current yield is below threshold or materially worse than the best filtered alternative.'
      : 'Current yield remains acceptable and no rotation trigger is satisfied.';

    const executionPayload = {
      targetPool: action === 'rotate' ? bestKey : currentPoolKey,
      action,
      policy: {
        threshold,
        minDelta,
        filter
      },
      reason,
      txPayload: action === 'rotate'
        ? {
            protocol: 'hodlmm',
            type: 'rotate-yield-position',
            fromPool: currentPoolKey,
            toPool: bestKey,
            trigger: 'threshold-breach-or-yield-gap'
          }
        : null
    };

    const proofSource = {
      skillName: SKILL_NAME,
      skillVersion: SKILL_VERSION,
      timestamp,
      decision: action,
      executionPayload
    };
    const hash = crypto.createHash('sha256').update(stableStringify(proofSource)).digest('hex');

    const output = {
      status: 'success',
      action,
      data: {
        source: 'live-bitflow-earn',
        protocol: 'hodlmm',
        filter,
        currentPosition: {
          pool: currentPoolKey,
          currentYield
        },
        bestAlternative: {
          pool: bestKey,
          bestYield
        },
        policy: {
          threshold,
          minDelta
        },
        decision: action,
        executionPayload,
        proof: {
          skillName: SKILL_NAME,
          skillVersion: SKILL_VERSION,
          timestamp,
          hash,
          signature: null
        },
        rawSnippet: {
          currentPool,
          bestPool: pools[bestKey]
        }
      },
      error: null
    };

    console.log(JSON.stringify(output, null, 2));
  } catch (error) {
    console.log(JSON.stringify({
      status: 'error',
      action: 'failed',
      data: {},
      error: error.message
    }, null, 2));
    process.exit(1);
  }
})();
