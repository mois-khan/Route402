import { paymentMiddlewareFromHTTPServer, x402ResourceServer, x402HTTPResourceServer } from '@x402/express';
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
  const resourceServer = new x402ResourceServer(facilitatorClient).register(networkCaip2, new ExactAvmScheme());

  const httpServer = new x402HTTPResourceServer(resourceServer, {
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
  });

  // `httpServer.initialize()` fetches supported-kinds from the facilitator
  // before any payment requirement can be built. paymentMiddlewareFromConfig's
  // own `syncFacilitatorOnStart: true` fires this at module-load time as an
  // unawaited promise — if the router (which hosts our facilitator) isn't
  // listening yet, that's an unhandled rejection that crashes the whole
  // provider process (confirmed live: `npm run dev` starts all 5 services
  // with no ordering guarantee, so this raced on every other boot). Managing
  // the retry ourselves, with every rejection caught, means the provider
  // stays up regardless of boot order — its `/health` and `/_chaos` work
  // immediately, and the capability route starts working the moment the
  // router is reachable.
  void (async function initWithRetry() {
    for (;;) {
      try {
        await httpServer.initialize();
        return;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  })();

  return paymentMiddlewareFromHTTPServer(httpServer, undefined, undefined, false);
}
