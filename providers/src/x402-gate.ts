import { paymentMiddlewareFromConfig } from '@x402/express';
import { HTTPFacilitatorClient } from '@x402/core/http';
import { ExactAvmScheme } from '@x402/avm/exact/server';
import { ALGORAND_TESTNET_CAIP2, ALGORAND_MAINNET_CAIP2, USDC_TESTNET_ASA_ID, USDC_MAINNET_ASA_ID } from '@x402/avm';
import type { ProviderProfile } from './profiles.js';

/**
 * PRD §10.2 / Phase 3b — gates `profile.path` behind a real x402 402.
 * Wraps the existing capability handler unchanged; payment verification and
 * settlement happen entirely inside this middleware, in front of it.
 *
 * Points at Route402's own self-hosted facilitator (router :4000/facilitator/*),
 * not GoPlausible's hosted one — see docs/VERIFY.md "Architecture decision".
 */

const network = process.env.NETWORK === 'mainnet' ? 'mainnet' : 'testnet';
const networkCaip2 = network === 'mainnet' ? ALGORAND_MAINNET_CAIP2 : ALGORAND_TESTNET_CAIP2;
const usdcAsaId = network === 'mainnet' ? USDC_MAINNET_ASA_ID : USDC_TESTNET_ASA_ID;

export function x402Gate(profile: ProviderProfile) {
  const facilitatorClient = new HTTPFacilitatorClient({ url: process.env.FACILITATOR_URL });

  return paymentMiddlewareFromConfig(
    {
      [profile.path]: {
        accepts: {
          scheme: 'exact',
          network: networkCaip2,
          // Already atomic USDC units (micro-USDC === USDC's 6 decimals) — an
          // explicit AssetAmount, not a decimal Money string, so no unit
          // conversion happens between our ledger and the on-chain amount.
          price: { asset: usdcAsaId, amount: String(profile.advertisedPriceMicroUSDC) },
          payTo: profile.walletAddress,
          maxTimeoutSeconds: profile.maxTimeoutSeconds,
        },
        resource: profile.path,
        description: `${profile.name} — ${profile.capabilities[0]}`,
        mimeType: 'application/json',
      },
    },
    facilitatorClient,
    [{ network: networkCaip2, server: new ExactAvmScheme() }]
    // syncFacilitatorOnStart left at its default (true): the resource server
    // needs the facilitator's supported-kinds response before it can build
    // any payment requirement at all — there's no working lazy path, so the
    // router (which hosts the facilitator) has to be reachable by the time
    // a provider's first request lands, not just by the time it boots.
  );
}
