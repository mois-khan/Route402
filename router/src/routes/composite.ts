import type { FastifyInstance } from 'fastify';
import type { RouteConstraints, RouteDecision, CallRecord, PaymentRecord } from '@route402/shared';
import { registry } from '../registry.js';
import { score } from '../scorer.js';
import { explainDecision } from '../explain.js';
import { quoteProvider } from '../payment/x402.js';
import { settleCompositeGroup } from '../payment/composite.js';
import { verifyDelivery } from '../payment/guard.js';
import { explorerUrl } from '../payment/algorand.js';
import { insertDecision, insertCall, insertPayment, computeStats } from '../ledger/db.js';
import { config } from '../config.js';
import { id } from '../ids.js';
import { broadcast } from '../events.js';

/**
 * POST /v1/route/composite — Phase 6 (US8). Not part of PRD §10.1's binding
 * routes (composite requests aren't specified there at all); this is new
 * surface the phase explicitly asks for, kept additive rather than bent
 * into POST /v1/route's single-`capability` shape.
 *
 * Exactly two capabilities, one atomic payment group
 * (payment/composite.ts), single attempt per leg — no fallback loop. Once
 * the group is submitted, the payTo addresses are locked in; a fallback
 * would mean building an entirely new group, not retrying the same one, so
 * Phase 4's retry logic doesn't apply here. A leg that fails post-settlement
 * is marked `refused`, same guard semantics as the single-capability path,
 * but nothing re-routes.
 */

const DEFAULT_TIMEOUT_SECONDS = 30;

interface CompositeRequestBody {
  capabilities: string[];
  payload: Record<string, unknown>;
  constraints?: RouteConstraints;
  agentId?: string;
}

interface LegPick {
  capability: string;
  providerId: string;
  providerName: string;
  endpoint: string;
  decision: RouteDecision;
}

export function registerCompositeRoute(app: FastifyInstance): void {
  app.post<{ Body: CompositeRequestBody }>('/v1/route/composite', async (req, reply) => {
    const requestStarted = Date.now();
    const { capabilities, payload, constraints = {}, agentId } = req.body ?? ({} as CompositeRequestBody);

    if (!Array.isArray(capabilities) || capabilities.length !== 2) {
      reply.code(400);
      return { error: 'invalid_request', message: 'capabilities must be an array of exactly 2 capability names' };
    }

    const priority = constraints.priority ?? 'balanced';

    // Step 1 — pick a winner per capability (same scoring as the single
    // path). Each decision is final the moment it's built (no fallback loop
    // mutating it later), so it's written immediately.
    const legs: LegPick[] = [];
    for (const capability of capabilities) {
      const candidates = registry.getCandidates(capability);
      const scored = score(candidates, constraints);
      const eligible = scored.filter((c) => c.eligible).sort((a, b) => a.compositeScore - b.compositeScore);
      const winner = eligible[0];

      const decision: RouteDecision = {
        id: id('dec'),
        requestId: id('req'),
        capability,
        timestamp: Date.now(),
        candidates: scored,
        selectedProviderId: winner?.providerId ?? '',
        reason: winner
          ? explainDecision({ priority, candidates: scored, selectedProviderId: winner.providerId })
          : `No eligible provider for "${capability}".`,
        fallbackChain: winner ? [winner.providerId] : [],
      };
      insertDecision(decision, agentId, priority);
      broadcast({ type: 'decision', data: { ...decision, priority } });

      if (!winner) {
        reply.code(503);
        return { error: 'no_provider_available', message: `No eligible provider for "${capability}".`, attempted: [] };
      }

      const provider = registry.get(winner.providerId);
      if (!provider) throw new Error(`Scorer returned unknown provider "${winner.providerId}"`);

      legs.push({ capability, providerId: provider.id, providerName: provider.name, endpoint: provider.endpoint, decision });
    }

    // Step 2 — quote both legs (unpaid 402, no payment yet). Price is fixed
    // per provider regardless of payload content, so quoting the second leg
    // before the first leg has actually run (its real input) is safe.
    const quotes: { leg: LegPick; amountMicroUSDC: number; payTo: string; maxTimeoutSeconds: number }[] = [];
    for (const leg of legs) {
      const quote = await quoteProvider(leg.endpoint, payload);
      if (!quote.ok || !quote.requirement) {
        reply.code(502);
        return { error: 'quote_failed', message: `Could not get a quote from ${leg.providerName}: ${quote.error ?? 'unknown error'}` };
      }
      quotes.push({
        leg,
        amountMicroUSDC: Number(quote.requirement.amount),
        payTo: quote.requirement.payTo,
        maxTimeoutSeconds: quote.requirement.maxTimeoutSeconds,
      });
    }

    const totalMicroUSDC = quotes.reduce((sum, q) => sum + q.amountMicroUSDC, 0);
    if (constraints.maxPriceMicroUSDC !== undefined && totalMicroUSDC > constraints.maxPriceMicroUSDC) {
      reply.code(402);
      return {
        error: 'no_affordable_provider',
        message: `Composite quote totals ${totalMicroUSDC} µUSDC, ceiling is ${constraints.maxPriceMicroUSDC}.`,
        cheapestAvailableMicroUSDC: totalMicroUSDC,
      };
    }

    // Step 3 — one atomic group, both legs, submitted once.
    let settlement;
    try {
      settlement = await settleCompositeGroup(quotes.map((q) => ({ payTo: q.payTo, amountMicroUSDC: q.amountMicroUSDC })));
    } catch (err) {
      reply.code(502);
      return { error: 'settlement_failed', message: err instanceof Error ? err.message : 'Composite settlement failed.' };
    }

    // Step 4 — call each provider with proof of its own leg, piping the
    // first leg's output into the second leg's payload.
    let nextPayload: Record<string, unknown> = payload;
    const results: { capability: string; result: unknown }[] = [];

    for (let i = 0; i < quotes.length; i++) {
      const { leg, amountMicroUSDC } = quotes[i];
      const txId = settlement.txIds[i];

      const call: CallRecord = {
        id: id('call'),
        decisionId: leg.decision.id,
        providerId: leg.providerId,
        startedAt: Date.now(),
        completedAt: null,
        latencyMs: null,
        outcome: 'error',
        httpStatus: null,
        errorDetail: null,
      };

      const basePayment = {
        id: id('pay'),
        decisionId: leg.decision.id,
        providerId: leg.providerId,
        amountMicroUSDC,
        network: config.network,
        txIds: [txId],
        groupId: settlement.groupId,
        feeSponsored: true,
        settledAt: Date.now(),
        finalityMs: settlement.finalityMs,
        explorerUrl: explorerUrl(txId),
      };

      let httpStatus: number | null = null;
      let body: unknown;
      try {
        const res = await fetch(leg.endpoint, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'X-Route402-Proof-Tx': txId },
          body: JSON.stringify(nextPayload),
        });
        httpStatus = res.status;
        body = await res.json().catch(() => undefined);
      } catch (err) {
        call.completedAt = Date.now();
        call.latencyMs = call.completedAt - call.startedAt;
        call.outcome = 'error';
        call.errorDetail = err instanceof Error ? err.message : 'network error';
        insertCall(call);
        broadcast({ type: 'call', data: call });
        registry.recordFailure(leg.providerId);
        // The group already settled — irreversible — but content never
        // arrived, so this leg is never counted as delivered.
        const payment: PaymentRecord = { ...basePayment, status: 'refused' };
        insertPayment(payment);
        broadcast({ type: 'payment', data: payment });
        broadcast({ type: 'stats', data: computeStats() });
        reply.code(502);
        return {
          error: 'delivery_failed',
          message: `${leg.providerName} settled but could not be reached for delivery: ${call.errorDetail}`,
          groupId: settlement.groupId,
        };
      }

      call.completedAt = Date.now();
      call.latencyMs = call.completedAt - call.startedAt;
      call.httpStatus = httpStatus;

      const guardResult = verifyDelivery({
        httpStatus,
        body,
        capability: leg.capability,
        elapsedMs: call.latencyMs,
        maxTimeoutSeconds: quotes[i].maxTimeoutSeconds ?? DEFAULT_TIMEOUT_SECONDS,
      });

      if (!guardResult.ok) {
        call.outcome = 'invalid_response';
        call.errorDetail = guardResult.reason ?? 'delivery guard rejected the response';
        insertCall(call);
        broadcast({ type: 'call', data: call });
        registry.recordFailure(leg.providerId);
        const payment: PaymentRecord = { ...basePayment, status: 'refused' };
        insertPayment(payment);
        broadcast({ type: 'payment', data: payment });
        broadcast({ type: 'stats', data: computeStats() });
        reply.code(502);
        return {
          error: 'delivery_failed',
          message: `${leg.providerName} settled but ${call.errorDetail}.`,
          groupId: settlement.groupId,
        };
      }

      call.outcome = 'success';
      insertCall(call);
      broadcast({ type: 'call', data: call });
      registry.recordSuccess(leg.providerId, call.latencyMs);
      const payment: PaymentRecord = { ...basePayment, status: 'settled' };
      insertPayment(payment);
      broadcast({ type: 'payment', data: payment });

      results.push({ capability: leg.capability, result: body });
      // Pipe this leg's output into the next leg's input (summarize → translate).
      const outputText = extractPipeableText(body);
      nextPayload = outputText !== null ? { ...nextPayload, text: outputText } : nextPayload;
    }

    broadcast({ type: 'stats', data: computeStats() });

    return {
      requestId: legs[0].decision.requestId,
      results,
      routing: legs.map((leg) => ({
        capability: leg.capability,
        selectedProvider: leg.providerId,
        selectedProviderName: leg.providerName,
        reason: leg.decision.reason,
        decisionId: leg.decision.id,
      })),
      payment: {
        amountMicroUSDC: totalMicroUSDC,
        network: config.network,
        groupId: settlement.groupId,
        txIds: settlement.txIds,
        feeSponsored: true,
        finalityMs: settlement.finalityMs,
        explorerUrl: explorerUrl(settlement.txIds[0]),
      },
      timing: {
        totalMs: Date.now() - requestStarted,
      },
    };
  });
}

/** Best-effort: pull the text-shaped field out of one leg's result to feed the next. Only text.summarize's `summary` and text.translate's `translation` exist today. */
function extractPipeableText(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) return null;
  const record = body as Record<string, unknown>;
  if (typeof record.summary === 'string') return record.summary;
  if (typeof record.translation === 'string') return record.translation;
  return null;
}
