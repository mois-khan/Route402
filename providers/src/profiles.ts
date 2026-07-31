import 'dotenv/config';

/**
 * The three simulated providers.
 *
 * The point of the spread is that no single one is the obvious answer:
 * Alpha wins on cost, Gamma wins on speed, Beta wins on balance. A router
 * that always picks the same provider is indistinguishable from a hardcoded
 * URL, which is the thing this project exists to replace.
 */

export interface ProviderProfile {
  /** Matches the `prov_` id used across the ledger and dashboard. */
  id: string;
  name: string;
  port: number;
  capabilities: string[];
  /** Path the capability is served on, e.g. "/summarize". */
  path: string;
  advertisedPriceMicroUSDC: number;
  /** Target median latency. Every call jitters ±25% around this. */
  latencyP50Ms: number;
  /**
   * Declared p95. Consistent with the ±25% jitter band, so the registry's
   * observed p95 in Phase 2 should land close to it. Chaos `slow` is defined
   * as a multiple of this.
   */
  latencyP95Ms: number;
  /**
   * Declared deadline, surfaced in the 402 body (PRD §10.2) and enforced by
   * the router's guard in Phase 4.
   *
   * PRD §10.2's example shows 30s. That is a sane production number and an
   * unwatchable demo one — a `slow` provider would stall the stage for half a
   * minute per attempt, three times over during fallback. 4s sits far above
   * every provider's real p95 (Alpha's is 1700ms) while keeping a failed
   * attempt short enough to narrate.
   */
  maxTimeoutSeconds: number;
  /** Algorand payout address. Empty until Phase 3. */
  walletAddress: string;
}

const num = (v: string | undefined, fallback: number): number => {
  const n = Number(v);
  return Number.isFinite(n) && v !== undefined && v !== '' ? n : fallback;
};

export const PROFILES: Record<string, ProviderProfile> = {
  alpha: {
    id: 'prov_alpha',
    name: 'Alpha Summarize',
    port: num(process.env.PROVIDER_ALPHA_PORT, 4001),
    capabilities: ['text.summarize'],
    path: '/summarize',
    advertisedPriceMicroUSDC: 8_000, // cheap
    latencyP50Ms: 1_400, // slow
    latencyP95Ms: 1_700,
    maxTimeoutSeconds: 4,
    walletAddress: process.env.PROVIDER_ALPHA_ADDRESS || '',
  },
  beta: {
    id: 'prov_beta',
    name: 'Beta Summarize',
    port: num(process.env.PROVIDER_BETA_PORT, 4002),
    capabilities: ['text.summarize'],
    path: '/summarize',
    advertisedPriceMicroUSDC: 12_000, // mid
    latencyP50Ms: 700, // mid
    latencyP95Ms: 850,
    maxTimeoutSeconds: 4,
    walletAddress: process.env.PROVIDER_BETA_ADDRESS || '',
  },
  gamma: {
    id: 'prov_gamma',
    name: 'Gamma Summarize',
    port: num(process.env.PROVIDER_GAMMA_PORT, 4003),
    capabilities: ['text.summarize'],
    path: '/summarize',
    advertisedPriceMicroUSDC: 22_000, // expensive
    latencyP50Ms: 250, // fast
    latencyP95Ms: 300,
    maxTimeoutSeconds: 4,
    walletAddress: process.env.PROVIDER_GAMMA_ADDRESS || '',
  },
};

export function loadProfile(key: string | undefined): ProviderProfile {
  const profile = key ? PROFILES[key] : undefined;
  if (!profile) {
    const known = Object.keys(PROFILES).join(', ');
    throw new Error(`Unknown provider profile "${key ?? ''}". Expected one of: ${known}`);
  }
  return profile;
}

/**
 * Phase 6 (US8) — the second capability that makes a composite request
 * meaningful. PRD §8.1's `Provider` carries one price/latency per record, so
 * this isn't a second capability *on* the existing provider record — it's a
 * second, separately-scoreable registry entry (own id, own economics) that
 * happens to share the same process, port and wallet. Same spread pattern
 * as summarize: no single obvious winner.
 */
export interface TranslateProfile {
  id: string;
  name: string;
  path: string;
  advertisedPriceMicroUSDC: number;
  latencyP50Ms: number;
  latencyP95Ms: number;
}

export const TRANSLATE_PROFILES: Record<string, TranslateProfile> = {
  alpha: {
    id: 'prov_alpha_translate',
    name: 'Alpha Translate',
    path: '/translate',
    advertisedPriceMicroUSDC: 6_000, // cheap
    latencyP50Ms: 900, // slow
    latencyP95Ms: 1_100,
  },
  beta: {
    id: 'prov_beta_translate',
    name: 'Beta Translate',
    path: '/translate',
    advertisedPriceMicroUSDC: 9_000, // mid
    latencyP50Ms: 500, // mid
    latencyP95Ms: 650,
  },
  gamma: {
    id: 'prov_gamma_translate',
    name: 'Gamma Translate',
    path: '/translate',
    advertisedPriceMicroUSDC: 15_000, // expensive
    latencyP50Ms: 180, // fast
    latencyP95Ms: 230,
  },
};

export function loadTranslateProfile(key: string | undefined): TranslateProfile {
  const profile = key ? TRANSLATE_PROFILES[key] : undefined;
  if (!profile) {
    const known = Object.keys(TRANSLATE_PROFILES).join(', ');
    throw new Error(`Unknown translate profile "${key ?? ''}". Expected one of: ${known}`);
  }
  return profile;
}
