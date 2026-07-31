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
  /** Target median latency; Phase 1 adds jitter around this. */
  latencyP50Ms: number;
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
