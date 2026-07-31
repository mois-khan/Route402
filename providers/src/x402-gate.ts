import { paymentMiddlewareFromHTTPServer, x402ResourceServer, x402HTTPResourceServer } from '@x402/express';
import { HTTPFacilitatorClient } from '@x402/core/http';
import type { RouteConfig } from '@x402/core/server';
import { ExactAvmScheme } from '@x402/avm/exact/server';
import { ALGORAND_TESTNET_CAIP2, ALGORAND_MAINNET_CAIP2, USDC_TESTNET_ASA_ID, USDC_MAINNET_ASA_ID } from '@x402/avm';

/**
 * PRD §10.2 / Phase 3b — gates one or more capability paths behind a real
 * x402 402. Wraps the existing capability handlers unchanged; payment
 * verification and settlement happen entirely inside this middleware, in
 * front of them. One resource server per process, covering every
 * capability path that process serves (Phase 6 adds a second).
 *
 * Points at Route402's own self-hosted facilitator (router :4000/facilitator/*),
 * not GoPlausible's hosted one — see docs/VERIFY.md "Architecture decision".
 */

export interface GatedRoute {
  path: string;
  capability: string;
  name: string;
  advertisedPriceMicroUSDC: number;
  walletAddress: string;
  maxTimeoutSeconds: number;
}

const network = process.env.NETWORK === 'mainnet' ? 'mainnet' : 'testnet';
const networkCaip2 = network === 'mainnet' ? ALGORAND_MAINNET_CAIP2 : ALGORAND_TESTNET_CAIP2;
export const usdcAsaId = network === 'mainnet' ? USDC_MAINNET_ASA_ID : USDC_TESTNET_ASA_ID;

export function x402Gate(routes: GatedRoute[]) {
  const facilitatorClient = new HTTPFacilitatorClient({ url: process.env.FACILITATOR_URL });
  const resourceServer = new x402ResourceServer(facilitatorClient).register(networkCaip2, new ExactAvmScheme());

  const routesConfig: Record<string, RouteConfig> = Object.fromEntries(
    routes.map((r) => [
      r.path,
      {
        accepts: {
          scheme: 'exact',
          network: networkCaip2,
          // Already atomic USDC units (micro-USDC === USDC's 6 decimals) — an
          // explicit AssetAmount, not a decimal Money string, so no unit
          // conversion happens between our ledger and the on-chain amount.
          price: { asset: usdcAsaId, amount: String(r.advertisedPriceMicroUSDC) },
          payTo: r.walletAddress,
          maxTimeoutSeconds: r.maxTimeoutSeconds,
        },
        resource: r.path,
        description: `${r.name} — ${r.capability}`,
        mimeType: 'application/json',
      },
    ])
  );

  const httpServer = new x402HTTPResourceServer(resourceServer, routesConfig);

  // `httpServer.initialize()` fetches supported-kinds from the facilitator
  // before any payment requirement can be built. paymentMiddlewareFromConfig's
  // own `syncFacilitatorOnStart: true` fires this at module-load time as an
  // unawaited promise — if the router (which hosts our facilitator) isn't
  // listening yet, that's an unhandled rejection that crashes the whole
  // provider process (confirmed live: `npm run dev` starts all 5 services
  // with no ordering guarantee, so this raced on every other boot). Managing
  // the retry ourselves, with every rejection caught, means the provider
  // stays up regardless of boot order — its `/health` and `/_chaos` work
  // immediately, and the capability routes start working the moment the
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
