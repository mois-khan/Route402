import type { ProviderProfile } from './profiles.js';

/**
 * Provider failure simulation.
 *
 * Every mode here models an *external* event — a service falling over, not a
 * routing decision. The router must react to all four without a human in the
 * loop; the only human action is flipping the switch.
 */

export type ChaosMode = 'healthy' | 'offline' | 'slow' | 'garbage';

export const CHAOS_MODES: readonly ChaosMode[] = ['healthy', 'offline', 'slow', 'garbage'] as const;

export function isChaosMode(v: unknown): v is ChaosMode {
  return typeof v === 'string' && (CHAOS_MODES as readonly string[]).includes(v);
}

/**
 * Normal-operation latency: uniform ±25% around p50.
 *
 * Not a fixed sleep. A flat latency makes the registry's rolling p50/p95
 * window in Phase 2 meaningless — every percentile would be the same number,
 * and the scorer's latency term would look like a constant.
 */
export function jitteredLatencyMs(profile: ProviderProfile): number {
  return Math.round(profile.latencyP50Ms * (0.75 + Math.random() * 0.5));
}

/**
 * `slow` latency.
 *
 * The mode only proves something if the response actually misses the declared
 * deadline. 3× p95 is the intent, and it is enough for Alpha (5100ms vs a 4s
 * timeout) — but Gamma's 3× p95 is 900ms, comfortably *inside* the timeout, so
 * on its own the mode would be indistinguishable from a healthy call. The
 * floor is what guarantees every provider genuinely overruns.
 */
export function slowLatencyMs(profile: ProviderProfile): number {
  return Math.max(profile.latencyP95Ms * 3, profile.maxTimeoutSeconds * 1_000 + 2_000);
}

/**
 * The `garbage` payload: HTTP 200, correct shape, no content.
 *
 * A provider that fails loudly is easy to route around. This is the case the
 * guard exists for — a success status carrying nothing, which a router that
 * only checks `res.ok` would happily pay for.
 */
export const GARBAGE_BODY = { summary: '' } as const;

export interface Chaos {
  readonly mode: ChaosMode;
  /** epoch ms the current mode was entered */
  readonly since: number;
  set(next: ChaosMode): void;
  /** How long this call should take, given the current mode. */
  delayMs(): number;
}

export function createChaos(profile: ProviderProfile): Chaos {
  let mode: ChaosMode = 'healthy';
  let since = Date.now();

  return {
    get mode() {
      return mode;
    },
    get since() {
      return since;
    },
    set(next: ChaosMode) {
      if (next === mode) return;
      mode = next;
      since = Date.now();
    },
    delayMs() {
      // `garbage` keeps normal timing on purpose: junk returned at a plausible
      // speed is harder to catch than junk returned instantly.
      return mode === 'slow' ? slowLatencyMs(profile) : jitteredLatencyMs(profile);
    },
  };
}
