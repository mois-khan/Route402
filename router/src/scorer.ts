import type { Provider, RouteConstraints, ScoredCandidate, Priority } from '@route402/shared';

/**
 * PRD §9 — the routing algorithm. Pure function: candidates and constraints
 * in, scored candidates out. No I/O, no DB, no network, no clock. This is
 * what stays independently testable and explainable on stage.
 *
 * Eligibility rule 1 in §9.5 ("does not declare the requested capability")
 * is enforced by the caller — `registry.getCandidates(capability)` only ever
 * returns providers that declare it, and `score()`'s signature carries no
 * capability to re-check it against. Rules 2-4 are checked here.
 */

const WEIGHTS: Record<Priority, { price: number; latency: number; reliability: number }> = {
  cost: { price: 0.65, latency: 0.1, reliability: 0.25 },
  speed: { price: 0.1, latency: 0.65, reliability: 0.25 },
  balanced: { price: 0.35, latency: 0.35, reliability: 0.3 },
};

function normalize(value: number, min: number, max: number): number {
  return max === min ? 0 : (value - min) / (max - min);
}

function checkEligibility(p: Provider, constraints: RouteConstraints): { eligible: boolean; reason?: string } {
  if (constraints.excludeProviders?.includes(p.id)) {
    return { eligible: false, reason: 'excluded by request' };
  }
  if (p.circuitState === 'open') {
    return { eligible: false, reason: `circuit open after ${p.consecutiveFailures} consecutive failures` };
  }
  if (constraints.maxPriceMicroUSDC !== undefined && p.advertisedPriceMicroUSDC > constraints.maxPriceMicroUSDC) {
    return {
      eligible: false,
      reason: `exceeds max price (${p.advertisedPriceMicroUSDC} > ${constraints.maxPriceMicroUSDC} µUSDC)`,
    };
  }
  return { eligible: true };
}

/** Scored candidates, ascending by compositeScore (lowest — best — first), regardless of eligibility. */
export function score(candidates: Provider[], constraints: RouteConstraints = {}): ScoredCandidate[] {
  if (candidates.length === 0) return [];

  const priority = constraints.priority ?? 'balanced';
  const weights = WEIGHTS[priority];

  const prices = candidates.map((c) => c.advertisedPriceMicroUSDC);
  const latencies = candidates.map((c) => c.latencyP95Ms);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const minLatency = Math.min(...latencies);
  const maxLatency = Math.max(...latencies);

  const scored = candidates.map((c): ScoredCandidate => {
    const { eligible, reason } = checkEligibility(c, constraints);

    const total = c.successCount + c.failureCount;
    const reliability = total > 0 ? c.successCount / total : 1;
    const unreliability = 1 - reliability;

    const normPrice = normalize(c.advertisedPriceMicroUSDC, minPrice, maxPrice);
    const normLatency = normalize(c.latencyP95Ms, minLatency, maxLatency);
    // Applies before the circuit trips — one recent failure deprioritises a
    // provider without exiling it, so degradation reads as gradual on stage.
    const recentFailurePenalty = Math.min(c.consecutiveFailures * 0.15, 0.45);

    const compositeScore =
      weights.price * normPrice + weights.latency * normLatency + weights.reliability * unreliability + recentFailurePenalty;

    return {
      providerId: c.id,
      providerName: c.name,
      priceMicroUSDC: c.advertisedPriceMicroUSDC,
      expectedLatencyMs: c.latencyP95Ms,
      reliabilityScore: reliability,
      compositeScore,
      eligible,
      ineligibleReason: reason,
    };
  });

  return scored.sort((a, b) => a.compositeScore - b.compositeScore);
}

/** The lowest-compositeScore candidate that is actually eligible. `undefined` if none are. */
export function selectWinner(scored: ScoredCandidate[]): ScoredCandidate | undefined {
  return scored.filter((c) => c.eligible).sort((a, b) => a.compositeScore - b.compositeScore)[0];
}
