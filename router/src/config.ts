import 'dotenv/config';
import type { Network } from '@route402/shared';

/**
 * Environment access, in one place.
 *
 * Phase 3 values (wallets, facilitator, ASA id) are read but not required —
 * the system must boot and run Phases 0-2 with an empty .env. Anything that
 * genuinely cannot work without a key fails at the point of use, loudly,
 * not at import time.
 */

const num = (v: string | undefined, fallback: number): number => {
  const n = Number(v);
  return Number.isFinite(n) && v !== undefined && v !== '' ? n : fallback;
};

export const config = {
  network: (process.env.NETWORK === 'mainnet' ? 'mainnet' : 'testnet') as Network,

  routerPort: num(process.env.ROUTER_PORT, 4000),
  dbPath: process.env.DB_PATH || './data/route402.db',

  // Phase 3 — see docs/VERIFY.md. Empty until verified.
  algod: {
    server: process.env.ALGOD_SERVER || '',
    port: process.env.ALGOD_PORT || '',
    token: process.env.ALGOD_TOKEN || '',
  },
  facilitatorUrl: process.env.FACILITATOR_URL || '',
  usdcAsaId: process.env.USDC_ASA_ID || '',
  explorerTxTemplate: process.env.EXPLORER_TX_TEMPLATE || '',

  agentMnemonic: process.env.AGENT_MNEMONIC || '',
  sponsorMnemonic: process.env.SPONSOR_MNEMONIC || '',
} as const;

/** Which Phase 3 settings are still missing. Surfaced by GET /health. */
export function missingChainConfig(): string[] {
  const required: Record<string, string> = {
    ALGOD_SERVER: config.algod.server,
    FACILITATOR_URL: config.facilitatorUrl,
    USDC_ASA_ID: config.usdcAsaId,
    AGENT_MNEMONIC: config.agentMnemonic,
    SPONSOR_MNEMONIC: config.sponsorMnemonic,
  };
  return Object.entries(required)
    .filter(([, v]) => !v)
    .map(([k]) => k);
}
