import type { RouteDecision, PaymentRecord, SavingsSnapshot, Priority } from '@route402/shared';

/**
 * Additive fields the router's API sends beyond the strict PRD §8 shapes
 * (same pattern as GET /health's chaosMode) — mirrored here since the
 * dashboard can't import router/src types directly across the workspace
 * boundary.
 */
export type DecisionWithPriority = RouteDecision & { priority: Priority };

export type PaymentWithCreatedAt = PaymentRecord & { createdAt: number };

export interface StatsSnapshot extends SavingsSnapshot {
  avgSettlementMs: number;
}

/** GET /v1/calls' shape — feeds the per-provider sparklines. */
export interface CallSummary {
  providerId: string;
  latencyMs: number | null;
  failed: boolean;
  startedAt: number;
}

/** GET /v1/wallets — Phase 6 (US9), a real algod balance query, not a claimed number. */
export interface WalletBalances {
  agent: { address: string; algoMicroAlgos: number } | null;
  sponsor: { address: string; algoMicroAlgos: number } | null;
}
