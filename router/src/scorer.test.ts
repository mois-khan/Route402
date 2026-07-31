import { describe, expect, it } from 'vitest';
import type { Provider } from '@route402/shared';
import { score, selectWinner } from './scorer.js';

/**
 * PRD §16: the scorer is the only module with test coverage. It is pure, so
 * every case here is candidates-in / ScoredCandidate[]-out — no mocks, no DB.
 */

function provider(overrides: Partial<Provider> & Pick<Provider, 'id' | 'name' | 'advertisedPriceMicroUSDC' | 'latencyP95Ms'>): Provider {
  return {
    endpoint: '',
    capabilities: ['text.summarize'],
    walletAddress: '',
    registeredAt: 0,
    latencyP50Ms: Math.round(overrides.latencyP95Ms / 2),
    successCount: 1,
    failureCount: 0,
    circuitState: 'closed',
    circuitOpenedAt: null,
    consecutiveFailures: 0,
    ...overrides,
  };
}

const ALPHA = provider({ id: 'prov_alpha', name: 'Alpha', advertisedPriceMicroUSDC: 8_000, latencyP95Ms: 1_700 });
const BETA = provider({ id: 'prov_beta', name: 'Beta', advertisedPriceMicroUSDC: 12_000, latencyP95Ms: 850 });
const GAMMA = provider({ id: 'prov_gamma', name: 'Gamma', advertisedPriceMicroUSDC: 22_000, latencyP95Ms: 300 });
const THREE = [ALPHA, BETA, GAMMA];

function winnerId(candidates: Provider[], priority: 'cost' | 'speed' | 'balanced') {
  return selectWinner(score(candidates, { priority }))?.providerId;
}

describe('score — weight profiles (PRD §9.3)', () => {
  it('cost priority picks the cheapest provider (Alpha)', () => {
    expect(winnerId(THREE, 'cost')).toBe('prov_alpha');
  });

  it('speed priority picks the fastest provider (Gamma)', () => {
    expect(winnerId(THREE, 'speed')).toBe('prov_gamma');
  });

  it('balanced priority picks the middle-ground provider (Beta)', () => {
    expect(winnerId(THREE, 'balanced')).toBe('prov_beta');
  });
});

describe('score — normalisation', () => {
  it('guards divide-by-zero when every candidate shares a value', () => {
    const flat = [
      provider({ id: 'prov_a', name: 'A', advertisedPriceMicroUSDC: 10_000, latencyP95Ms: 500 }),
      provider({ id: 'prov_b', name: 'B', advertisedPriceMicroUSDC: 10_000, latencyP95Ms: 500 }),
    ];
    const scored = score(flat, { priority: 'cost' });
    // price and latency contribute 0 for every candidate; only reliability
    // (equal here too) remains, so both land on the same composite score.
    expect(scored[0].compositeScore).toBeCloseTo(scored[1].compositeScore, 10);
  });

  it('lower price yields a lower (better) composite score under cost priority', () => {
    const scored = score(THREE, { priority: 'cost' });
    const byId = Object.fromEntries(scored.map((c) => [c.providerId, c.compositeScore]));
    expect(byId.prov_alpha).toBeLessThan(byId.prov_beta);
    expect(byId.prov_beta).toBeLessThan(byId.prov_gamma);
  });
});

describe('score — eligibility filter (PRD §9.5)', () => {
  it('marks a circuit-open provider ineligible but keeps it in the output', () => {
    const alphaOpen = { ...ALPHA, circuitState: 'open' as const, consecutiveFailures: 3 };
    const scored = score([alphaOpen, BETA, GAMMA], { priority: 'cost' });
    expect(scored).toHaveLength(3);
    const alpha = scored.find((c) => c.providerId === 'prov_alpha')!;
    expect(alpha.eligible).toBe(false);
    expect(alpha.ineligibleReason).toMatch(/circuit open/);
  });

  it('marks a provider over the price ceiling ineligible with a populated reason', () => {
    const scored = score(THREE, { priority: 'cost', maxPriceMicroUSDC: 10_000 });
    const gamma = scored.find((c) => c.providerId === 'prov_gamma')!;
    expect(gamma.eligible).toBe(false);
    expect(gamma.ineligibleReason).toMatch(/exceeds max price/);
  });

  it('marks an excluded provider ineligible', () => {
    const scored = score(THREE, { priority: 'cost', excludeProviders: ['prov_alpha'] });
    const alpha = scored.find((c) => c.providerId === 'prov_alpha')!;
    expect(alpha.eligible).toBe(false);
    expect(alpha.ineligibleReason).toMatch(/excluded by request/);
  });

  it('re-routes to the next-best provider when the natural winner is ineligible', () => {
    expect(winnerId([{ ...ALPHA, circuitState: 'open', consecutiveFailures: 3 }, BETA, GAMMA], 'cost')).toBe('prov_beta');
  });
});

describe('score — recent failure penalty (PRD §9.4)', () => {
  it('adds 0.15 per consecutive failure', () => {
    const [healthy, failedOnce] = score(
      [ALPHA, { ...ALPHA, id: 'prov_alpha_2', consecutiveFailures: 1 }],
      { priority: 'balanced' }
    );
    expect(failedOnce.compositeScore - healthy.compositeScore).toBeCloseTo(0.15, 10);
  });

  it('caps the penalty at 0.45', () => {
    const [uncapped, capped] = score(
      [
        { ...ALPHA, id: 'prov_x', consecutiveFailures: 3 },
        { ...ALPHA, id: 'prov_y', consecutiveFailures: 10 },
      ],
      { priority: 'balanced' }
    );
    expect(uncapped.compositeScore).toBeCloseTo(capped.compositeScore, 10);
  });
});

describe('score — reliability', () => {
  it('computes reliabilityScore as successCount / (successCount + failureCount)', () => {
    const flaky = { ...ALPHA, successCount: 3, failureCount: 1 };
    const scored = score([flaky], { priority: 'balanced' });
    expect(scored[0].reliabilityScore).toBeCloseTo(0.75, 10);
  });
});

describe('selectWinner', () => {
  it('returns undefined when no candidate is eligible', () => {
    const allExcluded = THREE.map((p) => ({ ...p, circuitState: 'open' as const, consecutiveFailures: 3 }));
    const scored = score(allExcluded, { priority: 'cost' });
    expect(selectWinner(scored)).toBeUndefined();
  });

  it('returns an empty array for an empty candidate list', () => {
    expect(score([], { priority: 'cost' })).toEqual([]);
  });
});
