import { x402Client, x402HTTPClient } from '@x402/core/client';
import { ExactAvmScheme } from '@x402/avm/exact/client';
import type { PaymentRequired, PaymentRequirements, SettleResponse } from '@x402/core/types';
import { agentSigner, currentNetworkCaip2 } from './algorand.js';

/**
 * The router's x402 handshake against a provider (PRD §11.1): call unpaid,
 * parse the 402, validate the quote against the agent's ceiling, pay, retry.
 *
 * One attempt per call — fallback across providers on failure is Phase 4's
 * job. `routes/route.ts` is where that loop plugs in around this function.
 */

let httpClientCache: x402HTTPClient | null = null;

export function httpClient(): x402HTTPClient {
  if (!httpClientCache) {
    const client = new x402Client().register(currentNetworkCaip2(), new ExactAvmScheme(agentSigner()));
    httpClientCache = new x402HTTPClient(client);
  }
  return httpClientCache;
}

export interface QuoteResult {
  ok: boolean;
  requirement?: PaymentRequirements;
  /** The full decoded 402, needed by anything that goes on to call `httpClient().createPaymentPayload()` — never reconstruct a synthetic one from just `requirement`. */
  paymentRequired?: PaymentRequired;
  unpaidMs: number;
  error?: string;
}

/**
 * The unpaid half of the handshake only: call once without a payment header,
 * parse the 402, return the matching "exact" requirement. Shared by
 * `payAndCall` (normal single-payment path) and `payment/composite.ts`
 * (Phase 6 — quotes both legs before building one hand-built atomic group;
 * that flow reads `requirement` for payTo/amount/asset but never calls
 * `createPaymentPayload`, since it doesn't use @x402/avm's per-provider
 * payload at all — it submits its own hand-built group directly).
 */
export async function quoteProvider(endpoint: string, payload: Record<string, unknown>): Promise<QuoteResult> {
  const client = httpClient();
  const unpaidStarted = Date.now();
  const unpaidRes = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const unpaid = await client.processResponse(unpaidRes);
  const unpaidMs = Date.now() - unpaidStarted;

  if (unpaid.paymentStatus !== 'payment_required') {
    return { ok: false, unpaidMs, error: `expected 402, got status ${unpaid.status} (paymentStatus=${unpaid.paymentStatus})` };
  }
  const paymentRequired = unpaid.header as PaymentRequired;
  const requirement = paymentRequired.accepts.find((a) => a.scheme === 'exact' && a.network === currentNetworkCaip2());
  if (!requirement) {
    return { ok: false, unpaidMs, error: `provider offered no "exact" payment option on ${currentNetworkCaip2()}` };
  }
  return { ok: true, requirement, paymentRequired, unpaidMs };
}

export interface PaymentOutcome {
  ok: boolean;
  /** The provider's JSON response body (the capability output) on success. */
  body?: unknown;
  quoteMicroUSDC?: number;
  txId?: string;
  network?: string;
  /**
   * Wall-clock ms for the *first*, unpaid call — the provider's 402 plus
   * network overhead, not the capability handler's own execution time
   * (that only runs on the paid retry, sandwiched between the facilitator's
   * verify and settle). Used as a rough `providerMs` proxy until something
   * more precise is worth the plumbing.
   */
  unpaidMs?: number;
  /** Wall-clock ms for the paid retry round trip — verify + provider handler + on-chain settle, combined. */
  settlementMs?: number;
  /** HTTP status of the paid retry, for the guard's 2xx check. `null` if the request never got a response (timeout/network error). */
  httpStatus?: number | null;
  /** The provider's own declared deadline (from the 402's `accepts[]`), for the guard's timeout check. */
  maxTimeoutSeconds?: number;
  error?: string;
}

export async function payAndCall(
  endpoint: string,
  payload: Record<string, unknown>,
  maxPriceMicroUSDC: number | undefined
): Promise<PaymentOutcome> {
  const client = httpClient();

  const quote = await quoteProvider(endpoint, payload);
  const { unpaidMs } = quote;
  if (!quote.ok || !quote.requirement || !quote.paymentRequired) {
    return { ok: false, unpaidMs, error: quote.error };
  }
  const requirement = quote.requirement;
  const paymentRequired = quote.paymentRequired;

  const quoteMicroUSDC = Number(requirement.amount);
  if (maxPriceMicroUSDC !== undefined && quoteMicroUSDC > maxPriceMicroUSDC) {
    // PRD §11.1 step 3 — a quote above the agent's ceiling is a hard abort, not a negotiation.
    return {
      ok: false,
      unpaidMs,
      quoteMicroUSDC,
      error: `quote ${quoteMicroUSDC} µUSDC exceeds ceiling ${maxPriceMicroUSDC} µUSDC`,
    };
  }

  const paymentPayload = await client.createPaymentPayload(paymentRequired);
  const paymentHeaders = client.encodePaymentSignatureHeader(paymentPayload);

  // PRD §11.3's "arrived within the declared timeout" check, enforced at the
  // network layer: abort if the provider hasn't responded by its own quoted
  // deadline. Note (docs/VERIFY.md): this stops the router waiting and
  // makes it reroute, but can't reach into the provider process and cancel
  // an in-flight x402 settlement that finishes after the abort — an
  // inherent limit of a client-side timeout against a server-driven
  // settlement flow, not something Route402's own code controls.
  const timeoutMs = requirement.maxTimeoutSeconds * 1000;
  const controller = new AbortController();
  const timeoutTimer = setTimeout(() => controller.abort(), timeoutMs);

  const settleStarted = Date.now();
  let paidRes: Response;
  try {
    paidRes = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...paymentHeaders },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (err) {
    const settlementMs = Date.now() - settleStarted;
    const timedOut = err instanceof Error && err.name === 'AbortError';
    return {
      ok: false,
      unpaidMs,
      quoteMicroUSDC,
      settlementMs,
      httpStatus: null,
      maxTimeoutSeconds: requirement.maxTimeoutSeconds,
      error: timedOut
        ? `no response within the declared ${requirement.maxTimeoutSeconds}s timeout`
        : `network error: ${err instanceof Error ? err.message : String(err)}`,
    };
  } finally {
    clearTimeout(timeoutTimer);
  }

  const paid = await client.processResponse(paidRes);
  const settlementMs = Date.now() - settleStarted;

  if (paid.paymentStatus !== 'settled') {
    const header = paid.header as SettleResponse | PaymentRequired | undefined;
    // 'settle_failed' carries the reason on SettleResponse.errorMessage; a
    // second 402 (verify rejected the payment) carries it on PaymentRequired.error.
    const reason =
      header && 'errorMessage' in header ? header.errorMessage : header && 'error' in header ? header.error : undefined;
    return {
      ok: false,
      unpaidMs,
      quoteMicroUSDC,
      settlementMs,
      httpStatus: paid.status,
      maxTimeoutSeconds: requirement.maxTimeoutSeconds,
      error: reason ?? `payment not settled (status=${paid.status}, paymentStatus=${paid.paymentStatus})`,
    };
  }

  const settleResponse = paid.header as SettleResponse;
  return {
    ok: true,
    body: paid.body,
    quoteMicroUSDC,
    txId: settleResponse.transaction,
    network: settleResponse.network,
    unpaidMs,
    settlementMs,
    httpStatus: paid.status,
    maxTimeoutSeconds: requirement.maxTimeoutSeconds,
  };
}
