import 'dotenv/config';
import { registry } from './registry.js';

/**
 * Route402's own demo providers. Mirrors providers/src/profiles.ts's
 * economics exactly (Phase 1, Phase 6) — the registry needs its own copy
 * because self-registration (PRD §10.1 `POST /v1/providers`) is how a
 * genuine third party would join the pool, but these are seeded once at
 * boot so there's something to route to without a manual registration call.
 *
 * Phase 6 (US8): the three `_translate` entries aren't separate processes —
 * they're the same three Express services (same port, same wallet) serving
 * a second capability. PRD §8.1's `Provider` carries one price/latency per
 * record, so a second capability on the same provider needs its own
 * registry entry, not a second price field.
 */

interface SeedProfile {
  id: string;
  name: string;
  capability: string;
  port: number;
  /** Overrides the localhost default — set when the provider runs on its own host (e.g. deployed). */
  baseUrl: string;
  path: string;
  advertisedPriceMicroUSDC: number;
  latencyP50Ms: number;
  addressEnvVar: string;
}

const num = (v: string | undefined, fallback: number): number => {
  const n = Number(v);
  return Number.isFinite(n) && v !== undefined && v !== '' ? n : fallback;
};

const SEEDS: SeedProfile[] = [
  {
    id: 'prov_alpha',
    name: 'Verbio AI',
    capability: 'text.summarize',
    port: num(process.env.PROVIDER_ALPHA_PORT, 4001),
    baseUrl: process.env.PROVIDER_ALPHA_URL || '',
    path: '/summarize',
    advertisedPriceMicroUSDC: 8_000,
    latencyP50Ms: 1_400,
    addressEnvVar: 'PROVIDER_ALPHA_ADDRESS',
  },
  {
    id: 'prov_beta',
    name: 'Digest Labs',
    capability: 'text.summarize',
    port: num(process.env.PROVIDER_BETA_PORT, 4002),
    baseUrl: process.env.PROVIDER_BETA_URL || '',
    path: '/summarize',
    advertisedPriceMicroUSDC: 12_000,
    latencyP50Ms: 700,
    addressEnvVar: 'PROVIDER_BETA_ADDRESS',
  },
  {
    id: 'prov_gamma',
    name: 'Synthetica',
    capability: 'text.summarize',
    port: num(process.env.PROVIDER_GAMMA_PORT, 4003),
    baseUrl: process.env.PROVIDER_GAMMA_URL || '',
    path: '/summarize',
    advertisedPriceMicroUSDC: 22_000,
    latencyP50Ms: 250,
    addressEnvVar: 'PROVIDER_GAMMA_ADDRESS',
  },
  {
    id: 'prov_alpha_translate',
    name: 'Lingofy',
    capability: 'text.translate',
    port: num(process.env.PROVIDER_ALPHA_PORT, 4001),
    baseUrl: process.env.PROVIDER_ALPHA_URL || '',
    path: '/translate',
    advertisedPriceMicroUSDC: 6_000,
    latencyP50Ms: 900,
    addressEnvVar: 'PROVIDER_ALPHA_ADDRESS',
  },
  {
    id: 'prov_beta_translate',
    name: 'Polyglossia',
    capability: 'text.translate',
    port: num(process.env.PROVIDER_BETA_PORT, 4002),
    baseUrl: process.env.PROVIDER_BETA_URL || '',
    path: '/translate',
    advertisedPriceMicroUSDC: 9_000,
    latencyP50Ms: 500,
    addressEnvVar: 'PROVIDER_BETA_ADDRESS',
  },
  {
    id: 'prov_gamma_translate',
    name: 'Transluma',
    capability: 'text.translate',
    port: num(process.env.PROVIDER_GAMMA_PORT, 4003),
    baseUrl: process.env.PROVIDER_GAMMA_URL || '',
    path: '/translate',
    advertisedPriceMicroUSDC: 15_000,
    latencyP50Ms: 180,
    addressEnvVar: 'PROVIDER_GAMMA_ADDRESS',
  },
  {
    id: 'prov_alpha_provision',
    name: 'Ledgerbase',
    capability: 'db.provision',
    port: num(process.env.PROVIDER_ALPHA_PORT, 4001),
    baseUrl: process.env.PROVIDER_ALPHA_URL || '',
    path: '/provision',
    advertisedPriceMicroUSDC: 15_000,
    latencyP50Ms: 1_200,
    addressEnvVar: 'PROVIDER_ALPHA_ADDRESS',
  },
  {
    id: 'prov_beta_provision',
    name: 'Corestack',
    capability: 'db.provision',
    port: num(process.env.PROVIDER_BETA_PORT, 4002),
    baseUrl: process.env.PROVIDER_BETA_URL || '',
    path: '/provision',
    advertisedPriceMicroUSDC: 22_000,
    latencyP50Ms: 650,
    addressEnvVar: 'PROVIDER_BETA_ADDRESS',
  },
  {
    id: 'prov_gamma_provision',
    name: 'Vaultrix',
    capability: 'db.provision',
    port: num(process.env.PROVIDER_GAMMA_PORT, 4003),
    baseUrl: process.env.PROVIDER_GAMMA_URL || '',
    path: '/provision',
    advertisedPriceMicroUSDC: 35_000,
    latencyP50Ms: 300,
    addressEnvVar: 'PROVIDER_GAMMA_ADDRESS',
  },
  {
    id: 'prov_alpha_cloud',
    name: 'Driftcloud',
    capability: 'cloud.provision',
    port: num(process.env.PROVIDER_ALPHA_PORT, 4001),
    baseUrl: process.env.PROVIDER_ALPHA_URL || '',
    path: '/cloud',
    advertisedPriceMicroUSDC: 18_000,
    latencyP50Ms: 1_300,
    addressEnvVar: 'PROVIDER_ALPHA_ADDRESS',
  },
  {
    id: 'prov_beta_cloud',
    name: 'Nodeforge',
    capability: 'cloud.provision',
    port: num(process.env.PROVIDER_BETA_PORT, 4002),
    baseUrl: process.env.PROVIDER_BETA_URL || '',
    path: '/cloud',
    advertisedPriceMicroUSDC: 26_000,
    latencyP50Ms: 700,
    addressEnvVar: 'PROVIDER_BETA_ADDRESS',
  },
  {
    id: 'prov_gamma_cloud',
    name: 'Skyhaven',
    capability: 'cloud.provision',
    port: num(process.env.PROVIDER_GAMMA_PORT, 4003),
    baseUrl: process.env.PROVIDER_GAMMA_URL || '',
    path: '/cloud',
    advertisedPriceMicroUSDC: 40_000,
    latencyP50Ms: 320,
    addressEnvVar: 'PROVIDER_GAMMA_ADDRESS',
  },
  {
    id: 'prov_alpha_email',
    name: 'Mailtrail',
    capability: 'email.provision',
    port: num(process.env.PROVIDER_ALPHA_PORT, 4001),
    baseUrl: process.env.PROVIDER_ALPHA_URL || '',
    path: '/email',
    advertisedPriceMicroUSDC: 4_000,
    latencyP50Ms: 1_000,
    addressEnvVar: 'PROVIDER_ALPHA_ADDRESS',
  },
  {
    id: 'prov_beta_email',
    name: 'Postflow',
    capability: 'email.provision',
    port: num(process.env.PROVIDER_BETA_PORT, 4002),
    baseUrl: process.env.PROVIDER_BETA_URL || '',
    path: '/email',
    advertisedPriceMicroUSDC: 6_000,
    latencyP50Ms: 550,
    addressEnvVar: 'PROVIDER_BETA_ADDRESS',
  },
  {
    id: 'prov_gamma_email',
    name: 'Relayhive',
    capability: 'email.provision',
    port: num(process.env.PROVIDER_GAMMA_PORT, 4003),
    baseUrl: process.env.PROVIDER_GAMMA_URL || '',
    path: '/email',
    advertisedPriceMicroUSDC: 10_000,
    latencyP50Ms: 220,
    addressEnvVar: 'PROVIDER_GAMMA_ADDRESS',
  },
];

/** Idempotent — a provider already in the registry (resumed from the ledger) keeps its observed history. */
export function seedKnownProviders(): void {
  for (const s of SEEDS) {
    if (registry.get(s.id)) continue;
    registry.register({
      id: s.id,
      name: s.name,
      endpoint: `${s.baseUrl || `http://localhost:${s.port}`}${s.path}`,
      capabilities: [s.capability],
      advertisedPriceMicroUSDC: s.advertisedPriceMicroUSDC,
      walletAddress: process.env[s.addressEnvVar] || '',
      seedLatencyP50Ms: s.latencyP50Ms,
    });
  }
}
