import 'dotenv/config';
import type { Network } from '@route402/shared';

/**
 * Environment access, in one place.
 *
 * Phase 3 values (wallets, facilitator, node access) are read but not
 * required — the system must boot and run Phases 0-2 with an empty .env.
 * Anything that genuinely cannot work without a key fails at the point of
 * use, loudly, not at import time.
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
    serverTestnet: process.env.ALGOD_SERVER_TESTNET || '',
    token: process.env.ALGOD_TOKEN || '',
    indexerServerTestnet: process.env.INDEXER_SERVER_TESTNET || '',
    indexerToken: process.env.INDEXER_TOKEN || '',
  },

  // Route402 hosts its own facilitator in-process (docs/VERIFY.md
  // "Architecture decision"). This is where providers are told to call it.
  facilitatorUrl: process.env.FACILITATOR_URL || '',
  explorerTxTemplate: process.env.EXPLORER_TX_TEMPLATE || '',

  agentMnemonic: process.env.AGENT_MNEMONIC || '',
  agentAddress: process.env.AGENT_ADDRESS || '',
  sponsorMnemonic: process.env.SPONSOR_MNEMONIC || '',
  sponsorAddress: process.env.SPONSOR_ADDRESS || '',
} as const;

/** Which Phase 3 settings are still missing. Surfaced by GET /health. */
export function missingChainConfig(): string[] {
  const required: Record<string, string> = {
    ALGOD_SERVER_TESTNET: config.algod.serverTestnet,
    FACILITATOR_URL: config.facilitatorUrl,
    AGENT_MNEMONIC: config.agentMnemonic,
    SPONSOR_MNEMONIC: config.sponsorMnemonic,
  };
  return Object.entries(required)
    .filter(([, v]) => !v)
    .map(([k]) => k);
}
