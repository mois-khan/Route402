import type { FastifyInstance, FastifyReply } from 'fastify';
import type { RouteRequest, RouteDecision, ScoredCandidate, CallRecord, PaymentRecord } from '@route402/shared';
import { registry } from '../registry.js';
import { score } from '../scorer.js';
import { explainDecision } from '../explain.js';
import { payAndCall } from '../payment/x402.js';
import { verifyDelivery } from '../payment/guard.js';
import { explorerUrl } from '../payment/algorand.js';
import { insertDecision, insertCall, insertPayment, computeStats } from '../ledger/db.js';
import { config } from '../config.js';
import { id } from '../ids.js';
import { broadcast } from '../events.js';

/** PRD §9.7 — next-best eligible candidate, max 3 attempts per request. */
const MAX_ATTEMPTS = 3;
/** Fallback when a provider's own 402 doesn't carry a usable deadline. */
const DEFAULT_TIMEOUT_SECONDS = 30;

/**
 * `calls` and `payments` reference `decisions.id` by foreign key, and the
 * decision itself isn't final until the fallback loop ends (its
 * `selectedProviderId`/`reason`/`fallbackChain` depend on how the loop
 * played out) — so every attempt's rows are held here and written only
 * once, after the decision row that they point to actually exists. Each
 * write is broadcast to WS /v1/events (Phase 5) in the same order.
 */
function persist(decision: RouteDecision, agentId: string | undefined, calls: CallRecord[], payments: PaymentRecord[]): void {
  insertDecision(decision, agentId);
  broadcast({ type: 'decision', data: decision });
  for (const call of calls) {
    insertCall(call);
    broadcast({ type: 'call', data: call });
  }
  for (const payment of payments) {
    insertPayment(payment);
    broadcast({ type: 'payment', data: payment });
  }
  broadcast({ type: 'stats', data: computeStats() });
}

/**
 * POST /v1/route — PRD §10.1, single endpoint an agent needs.
 *
 * Phase 4: wraps Phase 3's single attempt in the fallback loop, and gates
 * every settled payment through the delivery guard (PRD §11.3) before it
 * counts as a real success — a guard failure marks the payment `refused`
 * and re-routes to the next-best candidate, same as an outright failure.
 */
export function registerRouteRoute(app: FastifyInstance): void {
  app.post<{ Body: RouteRequest }>('/v1/route', async (req, reply) => {
    const requestStarted = Date.now();
    const { capability, payload, constraints = {}, agentId } = req.body ?? ({} as RouteRequest);

    if (!capability || typeof capability !== 'string') {
      reply.code(400);
      return { error: 'invalid_request', message: 'capability is required' };
    }

    const decisionStarted = Date.now();
    const candidates = registry.getCandidates(capability);
    const scored = score(candidates, constraints);
    const decisionMs = Date.now() - decisionStarted;
    const priority = constraints.priority ?? 'balanced';

    const eligible = scored.filter((c) => c.eligible).sort((a, b) => a.compositeScore - b.compositeScore);

    const decision: RouteDecision = {
      id: id('dec'),
      requestId: id('req'),
      capability,
      timestamp: Date.now(),
      candidates: scored,
      selectedProviderId: '',
      reason: 'No eligible provider for this request.',
      fallbackChain: [],
    };

    if (eligible.length === 0) {
      persist(decision, agentId, [], []);
      return respondNoEligible(reply, capability, scored, constraints.maxPriceMicroUSDC);
    }

    const attempted: string[] = [];
    const calls: CallRecord[] = [];
    const payments: PaymentRecord[] = [];
    let lastError: string | undefined;

    for (const candidate of eligible) {
      if (attempted.length >= MAX_ATTEMPTS) break;
      attempted.push(candidate.providerId);

      const provider = registry.get(candidate.providerId);
      if (!provider) continue; // scorer only ever returns known registry candidates

      const call: CallRecord = {
        id: id('call'),
        decisionId: decision.id,
        providerId: provider.id,
        startedAt: Date.now(),
        completedAt: null,
        latencyMs: null,
        outcome: 'error',
        httpStatus: null,
        errorDetail: null,
      };
      calls.push(call);

      const outcome = await payAndCall(provider.endpoint, payload, constraints.maxPriceMicroUSDC);
      const completedAt = Date.now();
      const latencyMs = completedAt - call.startedAt;
      call.completedAt = completedAt;
      call.latencyMs = latencyMs;
      call.httpStatus = outcome.httpStatus ?? null;

      if (outcome.ok) {
        const guardResult = verifyDelivery({
          httpStatus: outcome.httpStatus ?? null,
          body: outcome.body,
          capability,
          elapsedMs: outcome.settlementMs ?? latencyMs,
          maxTimeoutSeconds: outcome.maxTimeoutSeconds ?? DEFAULT_TIMEOUT_SECONDS,
        });

        if (guardResult.ok) {
          call.outcome = 'success';
          registry.recordSuccess(provider.id, latencyMs);

          decision.selectedProviderId = provider.id;
          decision.fallbackChain = attempted;
          decision.reason = explainDecision({ priority, candidates: scored, selectedProviderId: provider.id });

          const payment: PaymentRecord = {
            id: id('pay'),
            decisionId: decision.id,
            providerId: provider.id,
            amountMicroUSDC: outcome.quoteMicroUSDC ?? provider.advertisedPriceMicroUSDC,
            network: config.network,
            txIds: outcome.txId ? [outcome.txId] : [],
            groupId: null,
            feeSponsored: true, // Route402's self-hosted facilitator always sponsors the group fee — see docs/VERIFY.md
            settledAt: Date.now(),
            finalityMs: outcome.settlementMs ?? null,
            status: 'settled',
            explorerUrl: outcome.txId ? explorerUrl(outcome.txId) : null,
          };
          payments.push(payment);
          persist(decision, agentId, calls, payments);

          return {
            requestId: decision.requestId,
            result: outcome.body,
            routing: {
              selectedProvider: provider.id,
              selectedProviderName: provider.name,
              reason: decision.reason,
              candidatesEvaluated: scored.length,
              fallbackChain: decision.fallbackChain,
              decisionId: decision.id,
            },
            payment: {
              amountMicroUSDC: payment.amountMicroUSDC,
              network: payment.network,
              txIds: payment.txIds,
              groupId: payment.groupId,
              feeSponsored: payment.feeSponsored,
              finalityMs: payment.finalityMs,
              explorerUrl: payment.explorerUrl,
            },
            timing: {
              decisionMs,
              providerMs: outcome.unpaidMs ?? 0,
              settlementMs: outcome.settlementMs ?? 0,
              totalMs: Date.now() - requestStarted,
            },
          };
        }

        // Settled on-chain (protocol only gates on HTTP status, docs/VERIFY.md)
        // but failed our own content check — never counted as a real success.
        call.outcome = 'invalid_response';
        call.errorDetail = guardResult.reason ?? 'delivery guard rejected the response';
        registry.recordFailure(provider.id);
        lastError = call.errorDetail;

        payments.push({
          id: id('pay'),
          decisionId: decision.id,
          providerId: provider.id,
          amountMicroUSDC: outcome.quoteMicroUSDC ?? provider.advertisedPriceMicroUSDC,
          network: config.network,
          txIds: outcome.txId ? [outcome.txId] : [],
          groupId: null,
          feeSponsored: true,
          settledAt: Date.now(),
          finalityMs: outcome.settlementMs ?? null,
          status: 'refused',
          explorerUrl: outcome.txId ? explorerUrl(outcome.txId) : null,
        });
        continue;
      }

      // Payment never settled at all — ceiling exceeded, provider self-gated
      // a bad result via non-2xx, timeout, network error, etc.
      call.outcome = outcome.httpStatus === null ? 'timeout' : 'error';
      call.errorDetail = outcome.error ?? 'payment failed';
      registry.recordFailure(provider.id);
      lastError = call.errorDetail;

      payments.push({
        id: id('pay'),
        decisionId: decision.id,
        providerId: provider.id,
        amountMicroUSDC: outcome.quoteMicroUSDC ?? provider.advertisedPriceMicroUSDC,
        network: config.network,
        txIds: [],
        groupId: null,
        feeSponsored: false,
        settledAt: null,
        finalityMs: null,
        status: 'failed',
        explorerUrl: null,
      });
    }

    decision.reason = `All ${attempted.length} attempted provider(s) failed for "${capability}".`;
    decision.fallbackChain = attempted;
    persist(decision, agentId, calls, payments);

    reply.code(503);
    return {
      error: 'no_provider_available',
      message: `All ${attempted.length} attempted providers for ${capability} failed.${lastError ? ` Last error: ${lastError}` : ''}`,
      attempted,
    };
  });
}

/** PRD §10.1's two error contracts, for the case where nothing was even eligible to attempt. */
function respondNoEligible(
  reply: FastifyReply,
  capability: string,
  scored: ScoredCandidate[],
  maxPriceMicroUSDC: number | undefined
) {
  if (scored.length === 0) {
    reply.code(503);
    return { error: 'no_provider_available', message: `No providers registered for capability "${capability}".`, attempted: [] };
  }

  const cheapest = scored.reduce((min, c) => (c.priceMicroUSDC < min.priceMicroUSDC ? c : min));
  if (maxPriceMicroUSDC !== undefined && cheapest.priceMicroUSDC > maxPriceMicroUSDC) {
    reply.code(402);
    return {
      error: 'no_affordable_provider',
      message: `Cheapest available provider costs ${cheapest.priceMicroUSDC} µUSDC, ceiling is ${maxPriceMicroUSDC}.`,
      cheapestAvailableMicroUSDC: cheapest.priceMicroUSDC,
    };
  }

  reply.code(503);
  return {
    error: 'no_provider_available',
    message: `All ${scored.length} providers for "${capability}" are unavailable.`,
    attempted: scored.map((c) => c.providerId),
  };
}
