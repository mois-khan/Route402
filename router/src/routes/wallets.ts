import type { FastifyInstance } from 'fastify';
import algosdk from 'algosdk';
import { config } from '../config.js';

/**
 * Phase 6 (US9) — "Assert the zero balance on the dashboard so it is
 * visible, not claimed." A real algod query, not a static badge.
 *
 * Precision note (docs/VERIFY.md): Algorand requires ~0.1 ALGO minimum
 * balance to exist plus ~0.1 ALGO per opted-in asset — an account holding
 * USDC cannot be *exactly* 0 ALGO. What fee abstraction actually delivers
 * is zero ALGO ever spent on transaction fees, not a zero balance. This
 * endpoint reports the real number either way rather than rounding the
 * claim to fit the pitch.
 */
export function registerWalletsRoute(app: FastifyInstance): void {
  app.get('/v1/wallets', async () => {
    if (!config.algod.serverTestnet || !config.agentAddress || !config.sponsorAddress) {
      return { agent: null, sponsor: null };
    }

    const client = new algosdk.Algodv2(config.algod.token, config.algod.serverTestnet, '');

    const [agentInfo, sponsorInfo] = await Promise.all([
      client.accountInformation(config.agentAddress).do(),
      client.accountInformation(config.sponsorAddress).do(),
    ]);

    return {
      agent: { address: config.agentAddress, algoMicroAlgos: Number(agentInfo.amount) },
      sponsor: { address: config.sponsorAddress, algoMicroAlgos: Number(sponsorInfo.amount) },
    };
  });
}
