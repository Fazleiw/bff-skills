#!/usr/bin/env bun

type RiskLevel = 'low' | 'medium' | 'high';
type Action = 'rotate' | 'stay' | 'wait' | 'block';

type Route = {
  route: string;
  protocol: string;
  projectedApyPct: number;
  confidence: number;
  risk: RiskLevel;
  source: string;
  notes: string[];
  live: boolean;
};

type Envelope = {
  status: 'success' | 'error' | 'blocked';
  action: string;
  data: unknown;
  error: string | null;
};

function print(obj: unknown) {
  console.log(JSON.stringify(obj, null, 2));
}

function printError(message: string) {
  print({ error: message });
}

function parseArgs(argv: string[]) {
  const [command, ...rest] = argv;
  const args: Record<string, string> = {};
  for (let i = 0; i < rest.length; i++) {
    const token = rest[i];
    if (token.startsWith('--')) {
      args[token.slice(2)] = rest[i + 1];
      i++;
    }
  }
  return { command, args };
}

async function fetchBitflowRoute(): Promise<Route> {
  const url = 'https://app.bitflow.finance/api/apy-v2';
  const res = await fetch(url, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`bitflow api returned ${res.status}`);
  const json = await res.json();

  const poolMap = json?.data?.pools && typeof json.data.pools === 'object' ? json.data.pools : null;
  if (!poolMap) throw new Error('bitflow response missing pools object');

  const entries = Object.entries(poolMap as Record<string, any>).map(([poolId, row]) => ({
    poolId,
    row,
    text: `${poolId} ${JSON.stringify(row)}`.toLowerCase(),
    apy: Number((row as any)?.apy ?? (row as any)?.apr ?? (row as any)?.netApy ?? 0)
  }));

  const sbtcEntries = entries.filter((entry) => entry.text.includes('sbtc'));
  if (sbtcEntries.length === 0) {
    throw new Error('no sbtc route found in bitflow response');
  }

  const best = sbtcEntries.sort((a, b) => b.apy - a.apy)[0];
  return {
    route: 'bitflow',
    protocol: best.text.includes('hodlmm') ? 'Bitflow HODLMM' : 'Bitflow',
    projectedApyPct: Number(best.apy || 0),
    confidence: 0.9,
    risk: 'medium',
    source: url,
    notes: ['live Bitflow APY endpoint reachable', `selected pool ${best.poolId}`],
    live: true
  };
}

function placeholderRoute(route: string, protocol: string, projectedApyPct: number, confidence: number, risk: RiskLevel, note: string): Route {
  return {
    route,
    protocol,
    projectedApyPct,
    confidence,
    risk,
    source: 'placeholder-reviewed-v1',
    notes: [note, 'route kept conservative until live reviewed source is wired'],
    live: false
  };
}

function compareRoutes(routes: Route[], minEdgeBps: number, maxRisk: RiskLevel) {
  const riskAllowed = (risk: RiskLevel) => {
    if (maxRisk === 'medium') return risk !== 'high';
    return risk === 'low';
  };

  const baseline = routes.find((r) => r.route === 'stay-in-wallet');
  if (!baseline) throw new Error('baseline route missing');

  const ranked = [...routes].sort((a, b) => {
    const aScore = a.projectedApyPct * a.confidence;
    const bScore = b.projectedApyPct * b.confidence;
    return bScore - aScore;
  });

  const best = ranked[0];
  const edgePct = best.projectedApyPct - baseline.projectedApyPct;
  const edgeBps = Math.round(edgePct * 100);

  let action: Action = 'wait';
  let reason = 'best route does not yet justify movement';

  if (!riskAllowed(best.risk)) {
    action = 'block';
    reason = 'best route exceeds allowed risk profile';
  } else if (best.confidence < 0.55) {
    action = 'block';
    reason = 'best route confidence is too low';
  } else if (best.route === 'stay-in-wallet') {
    action = 'stay';
    reason = 'no deployment route beats baseline after confidence adjustment';
  } else if (edgeBps >= minEdgeBps && best.confidence >= 0.7) {
    action = 'rotate';
    reason = 'best route clears edge and confidence thresholds';
  } else {
    action = 'wait';
    reason = 'route exists but edge or confidence is not strong enough yet';
  }

  return {
    action,
    decision: {
      route: best.route,
      protocol: best.protocol,
      reason,
      edgeBps,
      projectedApyPct: best.projectedApyPct,
      confidence: best.confidence,
      risk: best.risk
    },
    bestRoute: best,
    alternatives: ranked.slice(1)
  };
}

async function fetchHermeticaRoute(): Promise<Route> {
  const url = 'https://hermetica.fi';
  const res = await fetch(url, { headers: { accept: 'text/html, text/plain' } });
  if (!res.ok) throw new Error(`hermetica page returned ${res.status}`);
  const text = await res.text();
  const match = text.match(/>(\d+(?:\.\d+)?)%<|\b(\d+(?:\.\d+)?)%\s*APY\b/i);
  const raw = match?.[1] ?? match?.[2];
  if (!raw) throw new Error('no public APY found on Hermetica page');
  const apy = Number(raw);
  if (!Number.isFinite(apy)) throw new Error('invalid Hermetica APY value');
  return {
    route: 'hermetica',
    protocol: 'Hermetica hBTC',
    projectedApyPct: apy,
    confidence: 0.82,
    risk: 'medium',
    source: url,
    notes: ['public Hermetica landing page exposes APY', 'route treated as live quoted destination'],
    live: true
  };
}

async function getRoutes() {
  const routes: Route[] = [];
  let bitflowError: string | null = null;
  let hermeticaError: string | null = null;
  try {
    routes.push(await fetchBitflowRoute());
  } catch (error) {
    bitflowError = error instanceof Error ? error.message : String(error);
  }
  try {
    routes.push(await fetchHermeticaRoute());
  } catch (error) {
    hermeticaError = error instanceof Error ? error.message : String(error);
  }

  routes.push(placeholderRoute('zest', 'Zest', 4.2, 0.52, 'low', 'public Zest surface confirms route relevance but not a reviewed APY quote'));
  routes.push({
    route: 'stay-in-wallet',
    protocol: 'Wallet baseline',
    projectedApyPct: 0,
    confidence: 1,
    risk: 'low',
    source: 'local-baseline',
    notes: ['zero deployment baseline'],
    live: true
  });

  return { routes, bitflowError, hermeticaError };
}

async function doctor() {
  const { routes, bitflowError, hermeticaError } = await getRoutes();
  const degraded = Boolean(bitflowError || hermeticaError);
  const envelope: Envelope = {
    status: 'success',
    action: degraded ? 'degraded' : 'ready',
    data: {
      routeCount: routes.length,
      liveRoutes: routes.filter((r) => r.live).map((r) => r.route),
      placeholderRoutes: routes.filter((r) => !r.live).map((r) => r.route),
      bitflowReachable: !bitflowError,
      hermeticaReachable: !hermeticaError,
      bitflowError,
      hermeticaError,
      routes
    },
    error: null
  };
  print(envelope);
}

async function run(args: Record<string, string>) {
  const amount = Number(args.amount ?? '1');
  const minEdgeBps = Number(args['min-edge-bps'] ?? '150');
  const maxRisk = (args['max-risk'] ?? 'medium') as RiskLevel;

  if (!Number.isFinite(amount) || amount <= 0) {
    return printError('amount must be a positive number');
  }
  if (!['low', 'medium'].includes(maxRisk)) {
    return printError('max-risk must be low or medium');
  }

  const { routes, bitflowError, hermeticaError } = await getRoutes();
  const liveDeploymentRoutes = routes.filter((r) => r.live && r.route !== 'stay-in-wallet');
  if (liveDeploymentRoutes.length === 0) {
    const blocked: Envelope = {
      status: 'blocked',
      action: 'block',
      data: { reason: 'no live deployment route available', bitflowError, hermeticaError, routes },
      error: null
    };
    return print(blocked);
  }

  const compared = compareRoutes(routes, minEdgeBps, maxRisk);
  const envelope: Envelope = {
    status: compared.action === 'block' ? 'blocked' : 'success',
    action: compared.action,
    data: {
      amount,
      minEdgeBps,
      maxRisk,
      bitflowError,
      hermeticaError,
      ...compared
    },
    error: null
  };
  print(envelope);
}

async function main() {
  const { command, args } = parseArgs(process.argv.slice(2));
  if (!command || !['doctor', 'status', 'run'].includes(command)) {
    return printError('usage: doctor | status | run --amount <number> [--min-edge-bps <number>] [--max-risk <low|medium>]');
  }
  if (command === 'doctor' || command === 'status') return doctor();
  return run(args);
}

main().catch((error) => {
  printError(error instanceof Error ? error.message : String(error));
});
