#!/usr/bin/env bun

type Out = {
  status: 'success' | 'error' | 'blocked',
  action: string,
  data: any,
  error: null | { code: string; message: string; next: string }
};

function out(payload: Out, code = 0) {
  console.log(JSON.stringify(payload, null, 2));
  process.exit(code);
}

function arg(name: string, fallback?: string) {
  const idx = process.argv.indexOf(name);
  return idx >= 0 && process.argv[idx + 1] ? process.argv[idx + 1] : fallback;
}

async function fetchJson(url: string) {
  const res = await fetch(url, { headers: { 'user-agent': 'pool-health/1.0' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return await res.json();
}

function asNum(v: any): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function flattenPools(payload: any) {
  const pages = Array.isArray(payload?.pages) ? payload.pages : [payload];
  const groups = pages.flatMap((p: any) => Array.isArray(p?.data) ? p.data : Array.isArray(p) ? p : []);
  const rows = groups.flatMap((group: any) => {
    const pair = group?.pair || {};
    const pools = Array.isArray(group?.pools) ? group.pools : [];
    return pools.map((pool: any) => ({
      poolId: String(pool.poolId ?? pool.pool_id ?? pool.id ?? ''),
      poolContract: pool.poolContract ?? pool.pool_id ?? pool.id ?? null,
      category: Array.isArray(pool.types) ? pool.types.join(',') : pool.category ?? null,
      tokenX: pair.tokenX ?? pool.tokenX ?? null,
      tokenY: pair.tokenY ?? pool.tokenY ?? null,
      tvlUsd: asNum(pool.tvlUsd ?? pool.tvl_usd ?? pool?.calculatedData?.tvl_usd ?? 0),
      volume24hUsd: asNum(pool.volumeUsd1d ?? pool.volume_24h_usd ?? 0),
      fees24hUsd: asNum(pool.feesUsd1d ?? pool.fees_24h_usd ?? 0),
      apy: asNum(pool.apr24h ?? pool.apr ?? pool.apy ?? 0),
      reserve0: asNum(pool?.poolComposition?.tokenX?.liquidityUsd ?? pool?.reserve0 ?? 0),
      reserve1: asNum(pool?.poolComposition?.tokenY?.liquidityUsd ?? pool?.reserve1 ?? 0),
      raw: pool,
      groupRaw: group
    }));
  });
  return rows;
}

function findPool(payload: any, poolId: string) {
  const rows = flattenPools(payload);
  if (!rows.length) return null;
  return rows.find((r: any) => r.poolId === poolId || String(r.poolContract) === poolId) || rows.sort((a: any, b: any) => b.tvlUsd - a.tvlUsd)[0];
}

function analyzePool(pool: any, tradeSizeUsd: number) {
  const reserve0 = Math.max(asNum(pool.reserve0), 0);
  const reserve1 = Math.max(asNum(pool.reserve1), 0);
  const tvl = Math.max(asNum(pool.tvlUsd), 0);
  const volume24hUsd = Math.max(asNum(pool.volume24hUsd), 0);
  const fees24hUsd = Math.max(asNum(pool.fees24hUsd), 0);
  const apy = asNum(pool.apy);

  const bigger = Math.max(reserve0, reserve1, 1);
  const smaller = Math.max(Math.min(reserve0, reserve1), 1);
  const imbalanceRatio = Number((bigger / smaller).toFixed(4));
  const slippageEstimateBps = tvl > 0 ? Math.round((tradeSizeUsd / tvl) * 10000) : 99999;
  const feeYield24hBps = tvl > 0 ? Math.round((fees24hUsd / tvl) * 10000) : 0;
  const volumeToTvlRatio = tvl > 0 ? Number((volume24hUsd / tvl).toFixed(4)) : 0;

  let health: 'healthy' | 'watch' | 'avoid' = 'healthy';
  let action = 'Pool looks healthy enough for monitoring and preliminary execution review.';

  if (tvl <= 0) {
    health = 'avoid';
    action = 'No usable TVL detected. Avoid routing until pool data is verified.';
  } else if (imbalanceRatio >= 1.75 || slippageEstimateBps >= 300) {
    health = 'watch';
    action = 'Pool shows elevated imbalance or slippage. Reduce size or inspect manually.';
  }

  if (imbalanceRatio >= 2.5 || slippageEstimateBps >= 700) {
    health = 'avoid';
    action = 'Pool risk is high for this notional size. Do not route without deeper review.';
  }

  return {
    health,
    action,
    reserve0Usd: reserve0,
    reserve1Usd: reserve1,
    tvlUsd: tvl,
    volume24hUsd,
    fees24hUsd,
    apy,
    imbalanceRatio,
    slippageEstimateBps,
    feeYield24hBps,
    volumeToTvlRatio
  };
}

async function main() {
  const command = process.argv[2];
  const poolId = arg('--pool-id', 'dlmm_3')!;
  const tradeSizeUsd = asNum(arg('--trade-size-usd', '1000'));
  const category = arg('--category', 'DLMM')!;
  const groupedUrl = `https://beta.bitflow.finance/api/bff-proxy/api/app/v1/pools/grouped?categories=${encodeURIComponent(category)}`;
  const metricsUrl = 'https://beta.bitflow.finance/api/bff-proxy/api/app/v1/pools/metrics';
  const categoriesUrl = 'https://beta.bitflow.finance/api/bff-proxy/api/app/v1/pools/categories';

  if (command === 'doctor') {
    try {
      const [categories, metrics, grouped] = await Promise.all([
        fetchJson(categoriesUrl),
        fetchJson(metricsUrl),
        fetchJson(groupedUrl)
      ]);
      const pool = findPool(grouped, poolId);
      out({
        status: 'success',
        action: 'Bitflow endpoints are reachable. You can run pool-health now.',
        data: {
          command: 'doctor',
          endpoints: { categoriesUrl, metricsUrl, groupedUrl },
          sampleCategoryCount: Array.isArray(categories) ? categories.length : Array.isArray(categories?.data) ? categories.data.length : null,
          metricsKeys: Object.keys(metrics || {}).slice(0, 12),
          samplePoolId: pool?.poolId ?? null,
          samplePoolContract: pool?.poolContract ?? null,
          samplePoolTvlUsd: pool?.tvlUsd ?? null
        },
        error: null
      });
    } catch (e: any) {
      out({
        status: 'blocked',
        action: 'Bitflow pool endpoints are not reachable. Inspect the beta API paths.',
        data: { endpoints: { categoriesUrl, metricsUrl, groupedUrl } },
        error: { code: 'API_UNREACHABLE', message: String(e?.message || e), next: 'Verify the beta Bitflow proxy endpoints.' }
      }, 1);
    }
  }

  if (command === 'run') {
    try {
      const [grouped, metrics] = await Promise.all([
        fetchJson(groupedUrl),
        fetchJson(metricsUrl)
      ]);
      const pool = findPool(grouped, poolId);
      if (!pool) {
        out({
          status: 'blocked',
          action: 'No pool found for the requested id/category.',
          data: { poolId, groupedUrl },
          error: { code: 'POOL_NOT_FOUND', message: 'No matching pool was found in the grouped pool payload.', next: 'Try another pool id or category.' }
        }, 1);
      }
      const analysis = analyzePool(pool, tradeSizeUsd);
      out({
        status: 'success',
        action: analysis.action,
        data: {
          poolId: pool.poolId,
          poolContract: pool.poolContract,
          category: pool.category,
          tradeSizeUsd,
          tokens: {
            tokenX: pool.tokenX ? { symbol: pool.tokenX.symbol ?? null, contract: pool.tokenX.contract ?? pool.tokenX.tokenContract ?? null } : null,
            tokenY: pool.tokenY ? { symbol: pool.tokenY.symbol ?? null, contract: pool.tokenY.contract ?? pool.tokenY.tokenContract ?? null } : null
          },
          proof: {
            groupedUrl,
            metricsUrl,
            observedAt: new Date().toISOString()
          },
          metrics: analysis,
          rawSummary: {
            groupedPool: pool.raw,
            metricsSnapshot: metrics
          }
        },
        error: null
      });
    } catch (e: any) {
      out({
        status: 'error',
        action: 'Pool health check failed. Inspect the live Bitflow response.',
        data: { poolId, groupedUrl, metricsUrl },
        error: { code: 'RUN_FAILED', message: String(e?.message || e), next: 'Retry after confirming the endpoint and payload shape.' }
      }, 1);
    }
  }

  out({
    status: 'error',
    action: 'Use doctor or run.',
    data: { receivedCommand: command || null },
    error: { code: 'INVALID_COMMAND', message: 'Supported commands are doctor and run.', next: 'Run doctor first, then run.' }
  }, 1);
}

main();
