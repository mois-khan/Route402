import 'dotenv/config';
import { registry } from './registry.js';

/**
 * Route402's own three demo providers. Mirrors providers/src/profiles.ts's
 * economics exactly (Phase 1) — the registry needs its own copy because
 * self-registration (PRD §10.1 `POST /v1/providers`) is how a genuine third
 * party would join the pool, but these three are seeded once at boot so
 * there's something to route to without a manual registration call.
 */

interface SeedProfile {
  id: string;
  name: string;
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
    name: 'Alpha Summarize',
    port: num(process.env.PROVIDER_ALPHA_PORT, 4001),
    baseUrl: process.env.PROVIDER_ALPHA_URL || '',
    path: '/summarize',
    advertisedPriceMicroUSDC: 8_000,
    latencyP50Ms: 1_400,
    addressEnvVar: 'PROVIDER_ALPHA_ADDRESS',
  },
  {
    id: 'prov_beta',
    name: 'Beta Summarize',
    port: num(process.env.PROVIDER_BETA_PORT, 4002),
    baseUrl: process.env.PROVIDER_BETA_URL || '',
    path: '/summarize',
    advertisedPriceMicroUSDC: 12_000,
    latencyP50Ms: 700,
    addressEnvVar: 'PROVIDER_BETA_ADDRESS',
  },
  {
    id: 'prov_gamma',
    name: 'Gamma Summarize',
    port: num(process.env.PROVIDER_GAMMA_PORT, 4003),
    baseUrl: process.env.PROVIDER_GAMMA_URL || '',
    path: '/summarize',
    advertisedPriceMicroUSDC: 22_000,
    latencyP50Ms: 250,
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
      capabilities: ['text.summarize'],
      advertisedPriceMicroUSDC: s.advertisedPriceMicroUSDC,
      walletAddress: process.env[s.addressEnvVar] || '',
      seedLatencyP50Ms: s.latencyP50Ms,
    });
  }
}
