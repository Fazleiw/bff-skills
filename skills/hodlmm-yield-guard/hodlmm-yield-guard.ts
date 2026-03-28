#!/usr/bin/env node

const https = require('https');

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

(async () => {
  try {
    const url = 'https://app.bitflow.finance/api/apy-v2';
    const currentPoolKey = arg('--current-pool', 'xyk-pool-sbtc-stx-v-1-1');
    const threshold = Number(arg('--threshold', '10'));
    const minDelta = Number(arg('--min-delta', '1'));
    const filter = arg('--filter', 'xyk-pool');

    const payload = await fetchJson(url);
    const pools = payload?.data?.pools;
    if (!pools || typeof pools !== 'object') {
      throw new Error('No pools object found in live APY payload');
    }

    const currentPool = pools[currentPoolKey];
    if (!currentPool) {
      throw new Error(`Current pool not found: ${currentPoolKey}`);
    }

    const currentYield = Number(currentPool?.apy || 0);
    if (!Number.isFinite(currentYield)) {
      throw new Error(`Invalid current yield for pool: ${currentPoolKey}`);
    }

    const { bestKey, bestYield } = pickBestPool(pools, filter);
    if (!bestKey || !Number.isFinite(bestYield)) {
      throw new Error(`No valid pool found for filter: ${filter}`);
    }

    const action = decideYieldAction({ currentYield, bestYield, threshold, minDelta });
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
        alert: action === 'alert' ? 'Current yield is deteriorating without a clearly superior filtered alternative.' : null,
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
