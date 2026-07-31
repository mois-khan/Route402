/**
 * PRD §11.3 — verifies delivery before a settled payment is treated as
 * legitimate. Four checks: 2xx status, body parses, expected capability
 * field present and non-empty, arrived within the provider's declared
 * timeout. Any failure means the request is re-routed and this attempt is
 * recorded `refused`, never counted as a real success — even when, per
 * docs/VERIFY.md, the on-chain settlement itself already went through
 * (the protocol only gates on HTTP status; this is the independent,
 * content-aware second check for whatever that gate doesn't catch).
 *
 * Pure — no I/O, no clock reads. The caller measures elapsed time and hands
 * it in, same discipline as scorer.ts.
 */

/** Capability → the JSON field its result must carry, non-empty, to count as delivered. Extend as new capabilities are added (Phase 6: text.translate). */
const EXPECTED_FIELD: Record<string, string> = {
  'text.summarize': 'summary',
};

export interface DeliveryCheckInput {
  httpStatus: number | null;
  body: unknown;
  capability: string;
  elapsedMs: number;
  maxTimeoutSeconds: number;
}

export interface DeliveryCheckResult {
  ok: boolean;
  reason?: string;
}

export function verifyDelivery(input: DeliveryCheckInput): DeliveryCheckResult {
  const { httpStatus, body, capability, elapsedMs, maxTimeoutSeconds } = input;

  if (httpStatus === null || httpStatus < 200 || httpStatus >= 300) {
    return { ok: false, reason: `non-2xx status (${httpStatus ?? 'none'})` };
  }
  if (typeof body !== 'object' || body === null) {
    return { ok: false, reason: 'response body did not parse as a JSON object' };
  }
  const field = EXPECTED_FIELD[capability];
  if (field) {
    const value = (body as Record<string, unknown>)[field];
    if (typeof value !== 'string' || value.trim().length === 0) {
      return { ok: false, reason: `expected field "${field}" missing or empty` };
    }
  }
  if (elapsedMs > maxTimeoutSeconds * 1000) {
    return { ok: false, reason: `arrived after ${elapsedMs}ms, past the declared ${maxTimeoutSeconds}s timeout` };
  }
  return { ok: true };
}
