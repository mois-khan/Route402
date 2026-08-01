import type { ChaosMode } from '@route402/shared';
export { isChaosMode } from '@route402/shared';

/**
 * Provider failure simulation.
 *
 * Every mode here models an *external* event — a service falling over, not a
 * routing decision. The router must react to all four without a human in the
 * loop; the only human action is flipping the switch.
 */

/** The timing a capability advertises — everything `delayMs()` needs to simulate it honestly. */
export interface CapabilityTiming {
  latencyP50Ms: number;
  latencyP95Ms: number;
  maxTimeoutSeconds: number;
}

/**
 * Normal-operation latency: uniform ±25% around p50.
 *
 * Not a fixed sleep. A flat latency makes the registry's rolling p50/p95
 * window in Phase 2 meaningless — every percentile would be the same number,
 * and the scorer's latency term would look like a constant.
 */
export function jitteredLatencyMs(timing: CapabilityTiming): number {
  return Math.round(timing.latencyP50Ms * (0.75 + Math.random() * 0.5));
}

/**
 * `slow` latency.
 *
 * The mode only proves something if the response actually misses the declared
 * deadline. 3× p95 is the intent, and it is enough for Lexicon (5100ms vs a 4s
 * timeout) — but Nimbus's 3× p95 is 900ms, comfortably *inside* the timeout, so
 * on its own the mode would be indistinguishable from a healthy call. The
 * floor is what guarantees every provider genuinely overruns.
 */
export function slowLatencyMs(timing: CapabilityTiming): number {
  return Math.max(timing.latencyP95Ms * 3, timing.maxTimeoutSeconds * 1_000 + 2_000);
}

/**
 * The `garbage` payload: correct shape, no content.
 *
 * A provider that fails loudly is easy to route around. This is the case the
 * guard exists for — a response carrying nothing.
 *
 * Phase 3 finding (docs/VERIFY.md): x402 settlement is gated by the
 * middleware purely on HTTP status — `res.statusCode >= 400` cancels
 * payment, anything else settles, regardless of body content. A literal
 * `200 { summary: '' }` would therefore get paid automatically by the
 * protocol itself, before Route402's own guard ever saw it. `server.ts`
 * serves this with a non-2xx status so the on-chain settlement is refused
 * at the source — the router's guard (Phase 4) is the second, independent
 * line of defense for a provider that doesn't self-check this honestly.
 */
export const GARBAGE_BODY = { summary: '' } as const;

export interface Chaos {
  readonly mode: ChaosMode;
  /** epoch ms the current mode was entered */
  readonly since: number;
  set(next: ChaosMode): void;
  /** How long this call should take, given the current mode and the calling capability's own declared timing. */
  delayMs(timing: CapabilityTiming): number;
}

/**
 * One chaos state per process, shared across every capability that process
 * serves (Phase 6 adds a second) — `offline`/`slow`/`garbage`/`healthy`
 * model the *process* falling over, not one capability of it. Each call
 * site passes its own capability's timing in, so a `slow` translate call
 * and a `slow` summarize call correctly overrun their own declared deadline,
 * not each other's.
 */
export function createChaos(): Chaos {
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
    delayMs(timing: CapabilityTiming) {
      // `garbage` keeps normal timing on purpose: junk returned at a plausible
      // speed is harder to catch than junk returned instantly.
      return mode === 'slow' ? slowLatencyMs(timing) : jitteredLatencyMs(timing);
    },
  };
}
