import type { Priority, ScoredCandidate } from '@route402/shared';

/**
 * PRD §9.8 — one generated sentence per decision, never hand-templated at a
 * call site. `RouteDecision` itself carries no `priority` field (it isn't
 * part of the binding PRD §8.3 shape), so this takes the richer context the
 * scorer had at decision time and produces the string that becomes
 * `RouteDecision.reason`.
 */

export interface DecisionContext {
  priority: Priority;
  /** Full scored set for one capability, winner included. */
  candidates: ScoredCandidate[];
  selectedProviderId: string;
}

function maxBy<T>(items: T[], key: (t: T) => number): T | undefined {
  return items.reduce<T | undefined>((best, item) => (best === undefined || key(item) > key(best) ? item : best), undefined);
}

function minBy<T>(items: T[], key: (t: T) => number): T | undefined {
  return items.reduce<T | undefined>((best, item) => (best === undefined || key(item) < key(best) ? item : best), undefined);
}

const pctCheaper = (winner: number, rival: number) => Math.round(((rival - winner) / rival) * 100);
const speedRatio = (slow: number, fast: number) => Math.round((slow / fast) * 10) / 10;

/** " with comparable p95 latency" | " and faster too" | ", trading some speed for it" */
function latencyClause(winner: ScoredCandidate, rival: ScoredCandidate): string {
  const spread = Math.abs(winner.expectedLatencyMs - rival.expectedLatencyMs) / Math.max(winner.expectedLatencyMs, rival.expectedLatencyMs);
  if (spread < 0.3) return ' with comparable p95 latency';
  return winner.expectedLatencyMs < rival.expectedLatencyMs ? ' and faster too' : ', trading some speed for it';
}

/** " at a comparable price" | " and cheaper too" | ", trading some cost for it" */
function priceClause(winner: ScoredCandidate, rival: ScoredCandidate): string {
  const spread = Math.abs(winner.priceMicroUSDC - rival.priceMicroUSDC) / Math.max(winner.priceMicroUSDC, rival.priceMicroUSDC);
  if (spread < 0.3) return ' at a comparable price';
  return winner.priceMicroUSDC < rival.priceMicroUSDC ? ' and cheaper too' : ', trading some cost for it';
}

/**
 * The candidate that would have out-scored the winner on the priority's
 * primary axis, had it been eligible. When one exists, its exclusion *is*
 * the story — leading with a runner-up comparison instead would read as
 * evasive on stage ("why isn't the cheap one just picked?").
 */
function mostAttractiveExcluded(
  ineligible: ScoredCandidate[],
  priority: Priority,
  winner: ScoredCandidate
): ScoredCandidate | undefined {
  const key = priority === 'speed' ? (c: ScoredCandidate) => c.expectedLatencyMs : (c: ScoredCandidate) => c.priceMicroUSDC;
  const best = minBy(ineligible, key);
  return best && key(best) < key(winner) ? best : undefined;
}

export function explainDecision(ctx: DecisionContext): string {
  const { candidates, selectedProviderId, priority } = ctx;
  const winner = candidates.find((c) => c.providerId === selectedProviderId);
  if (!winner) return 'No eligible provider for this request.';

  const rivals = candidates.filter((c) => c.eligible && c.providerId !== selectedProviderId);
  const ineligible = candidates.filter((c) => !c.eligible);

  const excluded = mostAttractiveExcluded(ineligible, priority, winner);
  if (excluded) {
    return `${winner.providerName} selected: ${excluded.providerName} excluded (${excluded.ineligibleReason}).`;
  }

  if (priority === 'speed') {
    const slowest = maxBy(rivals, (c) => c.expectedLatencyMs);
    if (slowest) {
      return (
        `${winner.providerName} selected: priority=speed, and ${winner.providerName}'s p95 is ` +
        `${speedRatio(slowest.expectedLatencyMs, winner.expectedLatencyMs)}x faster than ${slowest.providerName}.`
      );
    }
  }

  if (priority === 'cost') {
    const priciest = maxBy(rivals, (c) => c.priceMicroUSDC);
    if (priciest) {
      return `${winner.providerName} selected: ${pctCheaper(winner.priceMicroUSDC, priciest.priceMicroUSDC)}% cheaper than ${priciest.providerName}${latencyClause(winner, priciest)}.`;
    }
  }

  // balanced — or cost/speed with no rival left to name.
  const runnerUp = minBy(rivals, (c) => c.compositeScore);
  if (runnerUp) {
    if (winner.priceMicroUSDC < runnerUp.priceMicroUSDC) {
      return `${winner.providerName} selected: ${pctCheaper(winner.priceMicroUSDC, runnerUp.priceMicroUSDC)}% cheaper than ${runnerUp.providerName}${latencyClause(winner, runnerUp)}.`;
    }
    return `${winner.providerName} selected: ${speedRatio(runnerUp.expectedLatencyMs, winner.expectedLatencyMs)}x faster than ${runnerUp.providerName}${priceClause(winner, runnerUp)}.`;
  }

  return `${winner.providerName} selected: only eligible provider for this request.`;
}
