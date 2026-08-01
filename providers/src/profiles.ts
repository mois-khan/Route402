import 'dotenv/config';

/**
 * The three simulated providers.
 *
 * The point of the spread is that no single one is the obvious answer:
 * Lexicon wins on cost, Nimbus wins on speed, Solace wins on balance. A router
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
   * every provider's real p95 (Lexicon's is 1700ms) while keeping a failed
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
    name: 'Lexicon Summarize',
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
    name: 'Solace Summarize',
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
    name: 'Nimbus Summarize',
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
    name: 'Lexicon Translate',
    path: '/translate',
    advertisedPriceMicroUSDC: 6_000, // cheap
    latencyP50Ms: 900, // slow
    latencyP95Ms: 1_100,
  },
  beta: {
    id: 'prov_beta_translate',
    name: 'Solace Translate',
    path: '/translate',
    advertisedPriceMicroUSDC: 9_000, // mid
    latencyP50Ms: 500, // mid
    latencyP95Ms: 650,
  },
  gamma: {
    id: 'prov_gamma_translate',
    name: 'Nimbus Translate',
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

/**
 * A third capability (`db.provision`), same pattern as Translate above: its
 * own registry entry (own id, own economics), same process/port/wallet as
 * the summarize/translate siblings — not a fourth entity.
 */
export interface ProvisionProfile {
  id: string;
  name: string;
  path: string;
  advertisedPriceMicroUSDC: number;
  latencyP50Ms: number;
  latencyP95Ms: number;
}

export const PROVISION_PROFILES: Record<string, ProvisionProfile> = {
  alpha: {
    id: 'prov_alpha_provision',
    name: 'Lexicon DB',
    path: '/provision',
    advertisedPriceMicroUSDC: 15_000, // cheap
    latencyP50Ms: 1_200, // slow
    latencyP95Ms: 1_450,
  },
  beta: {
    id: 'prov_beta_provision',
    name: 'Solace DB',
    path: '/provision',
    advertisedPriceMicroUSDC: 22_000, // mid
    latencyP50Ms: 650, // mid
    latencyP95Ms: 800,
  },
  gamma: {
    id: 'prov_gamma_provision',
    name: 'Nimbus DB',
    path: '/provision',
    advertisedPriceMicroUSDC: 35_000, // expensive
    latencyP50Ms: 300, // fast
    latencyP95Ms: 380,
  },
};

export function loadProvisionProfile(key: string | undefined): ProvisionProfile {
  const profile = key ? PROVISION_PROFILES[key] : undefined;
  if (!profile) {
    const known = Object.keys(PROVISION_PROFILES).join(', ');
    throw new Error(`Unknown provision profile "${key ?? ''}". Expected one of: ${known}`);
  }
  return profile;
}

/** A fourth capability (`cloud.provision`), same pattern as ProvisionProfile above. */
export interface CloudProfile {
  id: string;
  name: string;
  path: string;
  advertisedPriceMicroUSDC: number;
  latencyP50Ms: number;
  latencyP95Ms: number;
}

export const CLOUD_PROFILES: Record<string, CloudProfile> = {
  alpha: {
    id: 'prov_alpha_cloud',
    name: 'Lexicon Cloud',
    path: '/cloud',
    advertisedPriceMicroUSDC: 18_000, // cheap
    latencyP50Ms: 1_300, // slow
    latencyP95Ms: 1_600,
  },
  beta: {
    id: 'prov_beta_cloud',
    name: 'Solace Cloud',
    path: '/cloud',
    advertisedPriceMicroUSDC: 26_000, // mid
    latencyP50Ms: 700, // mid
    latencyP95Ms: 850,
  },
  gamma: {
    id: 'prov_gamma_cloud',
    name: 'Nimbus Cloud',
    path: '/cloud',
    advertisedPriceMicroUSDC: 40_000, // expensive
    latencyP50Ms: 320, // fast
    latencyP95Ms: 400,
  },
};

export function loadCloudProfile(key: string | undefined): CloudProfile {
  const profile = key ? CLOUD_PROFILES[key] : undefined;
  if (!profile) {
    const known = Object.keys(CLOUD_PROFILES).join(', ');
    throw new Error(`Unknown cloud profile "${key ?? ''}". Expected one of: ${known}`);
  }
  return profile;
}

/** A fifth capability (`email.provision`), same pattern again. */
export interface EmailProfile {
  id: string;
  name: string;
  path: string;
  advertisedPriceMicroUSDC: number;
  latencyP50Ms: number;
  latencyP95Ms: number;
}

export const EMAIL_PROFILES: Record<string, EmailProfile> = {
  alpha: {
    id: 'prov_alpha_email',
    name: 'Lexicon Email',
    path: '/email',
    advertisedPriceMicroUSDC: 4_000, // cheap
    latencyP50Ms: 1_000, // slow
    latencyP95Ms: 1_200,
  },
  beta: {
    id: 'prov_beta_email',
    name: 'Solace Email',
    path: '/email',
    advertisedPriceMicroUSDC: 6_000, // mid
    latencyP50Ms: 550, // mid
    latencyP95Ms: 680,
  },
  gamma: {
    id: 'prov_gamma_email',
    name: 'Nimbus Email',
    path: '/email',
    advertisedPriceMicroUSDC: 10_000, // expensive
    latencyP50Ms: 220, // fast
    latencyP95Ms: 280,
  },
};

export function loadEmailProfile(key: string | undefined): EmailProfile {
  const profile = key ? EMAIL_PROFILES[key] : undefined;
  if (!profile) {
    const known = Object.keys(EMAIL_PROFILES).join(', ');
    throw new Error(`Unknown email profile "${key ?? ''}". Expected one of: ${known}`);
  }
  return profile;
}
