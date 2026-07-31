import { x402Facilitator } from '@x402/core/facilitator';
import { ExactAvmScheme } from '@x402/avm/exact/facilitator';
import { currentNetworkCaip2, sponsorFacilitatorSigner } from './algorand.js';

/**
 * Route402's own x402 facilitator — verifies and settles payments, and pays
 * atomic-group fees with the SPONSOR wallet. Hosted in-process and exposed
 * over HTTP by routes/facilitator.ts.
 *
 * Why self-hosted rather than GoPlausible's hosted facilitator: the
 * protocol requires the unsigned fee-payer transaction's sender to be an
 * address the *facilitator* controls, so "the router's sponsor wallet
 * covers fees" (PRD §11.2) is only literally true if Route402 is the
 * facilitator. See docs/VERIFY.md, "Architecture decision".
 */

let instance: x402Facilitator | null = null;

/** Built lazily on first use, not at import time — needs SPONSOR_MNEMONIC, which may not be set yet in Phases 0-2. */
export function facilitator(): x402Facilitator {
  if (!instance) {
    instance = new x402Facilitator().register(currentNetworkCaip2(), new ExactAvmScheme(sponsorFacilitatorSigner()));
  }
  return instance;
}
