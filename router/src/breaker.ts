import type { CircuitState } from '@route402/shared';

/**
 * Circuit breaker state machine. Pure transition functions — given a snapshot
 * and (where relevant) the current time, return the next snapshot. No I/O,
 * no timers: whoever holds the mutable state (registry.ts) calls these and
 * persists the result.
 */

export const FAILURE_THRESHOLD = 3;
export const HALF_OPEN_COOLDOWN_MS = 30_000;

export interface CircuitSnapshot {
  circuitState: CircuitState;
  circuitOpenedAt: number | null;
  consecutiveFailures: number;
}

/** A success — including a half-open probe holding — fully recovers the breaker. */
export function onSuccess(_snapshot: CircuitSnapshot): CircuitSnapshot {
  return { circuitState: 'closed', circuitOpenedAt: null, consecutiveFailures: 0 };
}

/**
 * A failure. Three consecutive failures trip the breaker open; a failure
 * while `half_open` re-opens immediately regardless of count — the probe
 * didn't hold, so there is nothing tentative left to test.
 */
export function onFailure(snapshot: CircuitSnapshot, now: number): CircuitSnapshot {
  const consecutiveFailures = snapshot.consecutiveFailures + 1;
  const trips = snapshot.circuitState === 'half_open' || consecutiveFailures >= FAILURE_THRESHOLD;
  return trips
    ? { circuitState: 'open', circuitOpenedAt: now, consecutiveFailures }
    : { circuitState: 'closed', circuitOpenedAt: null, consecutiveFailures };
}

/**
 * Lazily flips a stale `open` breaker to `half_open` once the cooldown has
 * elapsed. Called by the registry before candidates are handed to the
 * scorer, so a recovered provider gets sampled again without a timer thread.
 */
export function withCooldown(snapshot: CircuitSnapshot, now: number): CircuitSnapshot {
  if (
    snapshot.circuitState === 'open' &&
    snapshot.circuitOpenedAt !== null &&
    now - snapshot.circuitOpenedAt >= HALF_OPEN_COOLDOWN_MS
  ) {
    return { ...snapshot, circuitState: 'half_open' };
  }
  return snapshot;
}
