/**
 * Route402 shared data models.
 *
 * Transcribed from PRD §8. These field names are BINDING — every workspace
 * reads and writes exactly these. If a field looks wrong, raise it; do not
 * silently rename it.
 *
 * Conventions:
 *   - All money is micro-USDC INTEGERS. Never floats, never a bare `price`.
 *   - All timestamps are epoch milliseconds, always `number`.
 *   - All ids carry a prefix: prov_ req_ dec_ pay_ call_
 */

// ─── 8.1 Provider ────────────────────────────────────────────────────────────

export type CircuitState = 'closed' | 'open' | 'half_open';

export interface Provider {
  id: string; // "prov_alpha"
  name: string; // "Alpha Summarize"
  endpoint: string; // "http://localhost:4001/summarize"
  capabilities: string[]; // ["text.summarize"]
  advertisedPriceMicroUSDC: number; // price per call, in micro-units
  walletAddress: string; // Algorand address to be paid
  registeredAt: number; // epoch ms
  // observed, not advertised:
  latencyP50Ms: number;
  latencyP95Ms: number;
  successCount: number;
  failureCount: number;
  circuitState: CircuitState;
  circuitOpenedAt: number | null;
  consecutiveFailures: number;
}

// ─── 8.2 RouteRequest ────────────────────────────────────────────────────────

export type Priority = 'cost' | 'speed' | 'balanced';

export interface RouteConstraints {
  maxPriceMicroUSDC?: number; // hard ceiling; never exceeded
  maxLatencyMs?: number; // soft preference
  priority?: Priority; // default 'balanced'
  excludeProviders?: string[];
}

export interface RouteRequest {
  capability: string; // "text.summarize"
  payload: Record<string, unknown>; // passed through to provider untouched
  constraints?: RouteConstraints;
  agentId?: string; // for attribution only
}

// ─── 8.3 RouteDecision ───────────────────────────────────────────────────────

export interface ScoredCandidate {
  providerId: string;
  providerName: string;
  priceMicroUSDC: number;
  expectedLatencyMs: number;
  reliabilityScore: number; // 0..1
  compositeScore: number; // lower is better
  eligible: boolean;
  ineligibleReason?: string; // "circuit open" | "exceeds max price" | ...
}

export interface RouteDecision {
  id: string; // "dec_..."
  requestId: string;
  capability: string;
  timestamp: number;
  candidates: ScoredCandidate[]; // ALL candidates, including rejected
  selectedProviderId: string;
  reason: string; // one-sentence human explanation
  fallbackChain: string[]; // provider ids attempted, in order
}

// ─── 8.4 PaymentRecord ───────────────────────────────────────────────────────

export type Network = 'testnet' | 'mainnet';

/** 'refused' = the guard blocked payment because delivery failed verification. */
export type PaymentStatus = 'pending' | 'settled' | 'failed' | 'refused';

export interface PaymentRecord {
  id: string;
  decisionId: string;
  providerId: string;
  amountMicroUSDC: number;
  network: Network;
  txIds: string[]; // all txns in the group
  groupId: string | null; // Algorand group id when grouped
  feeSponsored: boolean;
  settledAt: number | null;
  finalityMs: number | null; // submit -> confirmed
  status: PaymentStatus;
  explorerUrl: string | null;
}

// ─── 8.5 CallRecord ──────────────────────────────────────────────────────────

export type CallOutcome = 'success' | 'timeout' | 'error' | 'invalid_response';

export interface CallRecord {
  id: string;
  decisionId: string;
  providerId: string;
  startedAt: number;
  completedAt: number | null;
  latencyMs: number | null;
  outcome: CallOutcome;
  httpStatus: number | null;
  errorDetail: string | null;
}

// ─── 8.6 SavingsSnapshot ─────────────────────────────────────────────────────

/** Computed, not stored per-row. */
export interface SavingsSnapshot {
  totalRequests: number;
  totalSpentMicroUSDC: number;
  /** cost if every request went to the most expensive provider */
  naiveBaselineMicroUSDC: number;
  savedMicroUSDC: number;
  savedPercent: number;
  requestsRerouted: number; // saved by circuit breaker
  paymentsRefused: number;
}

// ─── Chaos control (PRD §10.1 POST /v1/providers/:id/chaos) ──────────────────
// Shared because three workspaces need it: providers/src/chaos.ts simulates
// it, router/src/routes/providers.ts proxies it, the dashboard's simulation
// controls (Phase 5) send it.

export type ChaosMode = 'healthy' | 'offline' | 'slow' | 'garbage';

export const CHAOS_MODES: readonly ChaosMode[] = ['healthy', 'offline', 'slow', 'garbage'] as const;

export function isChaosMode(v: unknown): v is ChaosMode {
  return typeof v === 'string' && (CHAOS_MODES as readonly string[]).includes(v);
}

// ─── WebSocket events (PRD §10.1, WS /v1/events) ─────────────────────────────

export type EventType = 'decision' | 'payment' | 'call' | 'circuit' | 'stats';

export interface RouterEvent {
  type: EventType;
  data: unknown;
}
