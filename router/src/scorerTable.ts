import type { Priority, Provider } from '@route402/shared';
import { score, selectWinner } from './scorer.js';
import { explainDecision } from './explain.js';

/**
 * Phase 2 exit check: "under cost Alpha wins; under speed Gamma wins; under
 * balanced Beta wins. Every decision explains itself in one sentence."
 *
 * Deliberately does not touch the registry or the ledger — this prints the
 * scorer's own arithmetic against known, hand-built candidates so the demo
 * table is reproducible and independent of whatever is in data/route402.db.
 *
 *   npm run scorer:table
 */

const CAPABILITY = 'text.summarize';

function provider(overrides: Partial<Provider> & Pick<Provider, 'id' | 'name' | 'advertisedPriceMicroUSDC' | 'latencyP95Ms'>): Provider {
  return {
    endpoint: '',
    capabilities: [CAPABILITY],
    walletAddress: '',
    registeredAt: Date.now(),
    latencyP50Ms: Math.round(overrides.latencyP95Ms / 2),
    successCount: 1,
    failureCount: 0,
    circuitState: 'closed',
    circuitOpenedAt: null,
    consecutiveFailures: 0,
    ...overrides,
  };
}

// Cold-start economics straight from providers/src/profiles.ts.
const BASE_CANDIDATES: Provider[] = [
  provider({ id: 'prov_alpha', name: 'Alpha Summarize', advertisedPriceMicroUSDC: 8_000, latencyP95Ms: 1_700 }),
  provider({ id: 'prov_beta', name: 'Beta Summarize', advertisedPriceMicroUSDC: 12_000, latencyP95Ms: 850 }),
  provider({ id: 'prov_gamma', name: 'Gamma Summarize', advertisedPriceMicroUSDC: 22_000, latencyP95Ms: 300 }),
];

const money = (n: number) => `${n.toLocaleString()}µ`;
const pct = (n: number) => `${(n * 100).toFixed(0)}%`;

function printTable(priority: Priority, candidates: Provider[]) {
  const scored = score(candidates, { priority });
  const winner = selectWinner(scored);

  console.log(`\n── priority: ${priority} ──`);
  console.log(
    ['provider', 'price', 'p95', 'reliability', 'composite', 'eligible', 'reason']
      .map((h) => h.padEnd(14))
      .join('')
  );
  for (const c of scored) {
    const marker = c.providerId === winner?.providerId ? '→ ' : '  ';
    console.log(
      marker +
        [
          c.providerName.padEnd(18),
          money(c.priceMicroUSDC).padEnd(10),
          `${c.expectedLatencyMs}ms`.padEnd(8),
          pct(c.reliabilityScore).padEnd(13),
          c.compositeScore.toFixed(4).padEnd(12),
          String(c.eligible).padEnd(10),
          c.ineligibleReason ?? '',
        ].join('')
    );
  }

  if (winner) {
    const reason = explainDecision({ priority, candidates: scored, selectedProviderId: winner.providerId });
    console.log(`reason: ${reason}`);
  } else {
    console.log('reason: no eligible provider.');
  }
}

console.log('Route402 — scorer table (Phase 2 exit check)');
printTable('cost', BASE_CANDIDATES);
printTable('speed', BASE_CANDIDATES);
printTable('balanced', BASE_CANDIDATES);

// Demonstrates PRD §9.8's third reason shape: the natural winner (cheapest
// Alpha) tripped its breaker, so Beta wins instead — and the reason leads
// with the exclusion, not a runner-up comparison.
console.log('\n── scenario: Alpha circuit open (3 consecutive failures) ──');
const alphaDown = BASE_CANDIDATES.map((c) =>
  c.id === 'prov_alpha' ? { ...c, circuitState: 'open' as const, consecutiveFailures: 3, circuitOpenedAt: Date.now() } : c
);
printTable('cost', alphaDown);
