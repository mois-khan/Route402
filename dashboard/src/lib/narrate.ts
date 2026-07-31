import type { RouteDecision, PaymentRecord } from '@route402/shared';
import { capabilityLabel } from './labels.js';

/**
 * DESIGN.md §3.7 — single source of narration sentences. No component
 * writes narrative text inline; every sentence in the app comes from here,
 * mirroring `explainDecision()`'s role on the router side.
 */

export interface Step {
  key: 'ask' | 'compare' | 'pick' | 'pay' | 'deliver';
  label: string;
  sentence: string;
  failed?: boolean;
  elapsedMs?: number;
}

export interface NarrateInput {
  decision: RouteDecision;
  /**
   * Every payment for this decision (any order) — route.ts writes exactly
   * one per attempt, so filtering + reordering by `fallbackChain` recovers
   * the full attempt sequence without a separate calls lookup.
   */
  payments: PaymentRecord[];
}

export function narrate({ decision, payments }: NarrateInput): Step[] {
  const steps: Step[] = [];

  steps.push({
    key: 'ask',
    label: 'Ask',
    sentence: `An agent needs ${capabilityLabel(decision.capability).toLowerCase()}.`,
  });

  const evaluated = decision.candidates.length;
  steps.push({
    key: 'compare',
    label: 'Compare',
    sentence: evaluated > 0 ? `Checking ${evaluated} provider${evaluated === 1 ? '' : 's'} that can do this.` : 'No providers registered for this yet.',
  });

  const wonName = decision.candidates.find((c) => c.providerId === decision.selectedProviderId)?.providerName;
  if (!wonName) {
    steps.push({ key: 'pick', label: 'Pick', sentence: decision.reason, failed: true });
    return steps;
  }

  // decision.reason is explainDecision()'s output for the final winner —
  // reused verbatim, not re-derived here.
  steps.push({ key: 'pick', label: 'Pick', sentence: decision.reason });

  const paymentsByProvider = new Map(payments.map((p) => [p.providerId, p]));
  decision.fallbackChain.forEach((providerId, i) => {
    const payment = paymentsByProvider.get(providerId);
    const providerName = decision.candidates.find((c) => c.providerId === providerId)?.providerName ?? providerId;

    if (i > 0) {
      steps.push({ key: 'pick', label: 'Pick', sentence: `Trying ${providerName} instead.` });
    }

    if (payment?.status === 'settled') {
      steps.push({ key: 'pay', label: 'Pay', sentence: `Paying ${providerName} on Algorand.`, elapsedMs: payment.finalityMs ?? undefined });
      steps.push({ key: 'deliver', label: 'Deliver', sentence: 'Result checked and sent back to the agent.' });
    } else if (payment?.status === 'refused') {
      steps.push({ key: 'deliver', label: 'Deliver', sentence: `${providerName} returned a bad result. Not paying.`, failed: true });
    } else {
      steps.push({ key: 'pay', label: 'Pay', sentence: `${providerName} could not be reached in time.`, failed: true });
    }
  });

  return steps;
}

/** Idle state for the "Right now" panel before the first request of a session. */
export const IDLE_SENTENCE = 'Waiting for a request.';
