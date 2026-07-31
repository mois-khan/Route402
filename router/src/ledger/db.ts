import Database from 'better-sqlite3';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { config } from '../config.js';
import type { Provider, RouteDecision, ScoredCandidate, CallRecord, PaymentRecord, SavingsSnapshot, Priority } from '@route402/shared';

/**
 * The ledger. SQLite via better-sqlite3 — synchronous, which removes an entire
 * class of race conditions during a live demo, and zero network dependency.
 */

let handle: Database.Database | null = null;

export function db(): Database.Database {
  if (handle) return handle;

  const path = resolve(process.cwd(), config.dbPath);
  mkdirSync(dirname(path), { recursive: true });

  handle = new Database(path);
  handle.pragma('journal_mode = WAL');
  handle.pragma('foreign_keys = ON');

  const schema = readFileSync(join(import.meta.dirname, 'schema.sql'), 'utf8');
  handle.exec(schema);

  return handle;
}

/** Table -> row count. Used by GET /health to prove the schema applied. */
export function ledgerCounts(): Record<string, number> {
  const d = db();
  const tables = ['providers', 'decisions', 'candidates', 'calls', 'payments'];
  const counts: Record<string, number> = {};
  for (const t of tables) {
    const row = d.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get() as { n: number };
    counts[t] = row.n;
  }
  return counts;
}

interface ProviderRow {
  id: string;
  name: string;
  endpoint: string;
  capabilities: string;
  advertised_price_micro_usdc: number;
  wallet_address: string;
  registered_at: number;
  latency_p50_ms: number;
  latency_p95_ms: number;
  success_count: number;
  failure_count: number;
  circuit_state: Provider['circuitState'];
  circuit_opened_at: number | null;
  consecutive_failures: number;
}

function rowToProvider(row: ProviderRow): Provider {
  return {
    id: row.id,
    name: row.name,
    endpoint: row.endpoint,
    capabilities: JSON.parse(row.capabilities) as string[],
    advertisedPriceMicroUSDC: row.advertised_price_micro_usdc,
    walletAddress: row.wallet_address,
    registeredAt: row.registered_at,
    latencyP50Ms: row.latency_p50_ms,
    latencyP95Ms: row.latency_p95_ms,
    successCount: row.success_count,
    failureCount: row.failure_count,
    circuitState: row.circuit_state,
    circuitOpenedAt: row.circuit_opened_at,
    consecutiveFailures: row.consecutive_failures,
  };
}

/** Insert-or-update the full `providers` row. The registry is the only writer. */
export function upsertProvider(p: Provider): void {
  db()
    .prepare(
      `INSERT INTO providers (
         id, name, endpoint, capabilities, advertised_price_micro_usdc, wallet_address,
         registered_at, latency_p50_ms, latency_p95_ms, success_count, failure_count,
         circuit_state, circuit_opened_at, consecutive_failures
       ) VALUES (
         @id, @name, @endpoint, @capabilities, @advertisedPriceMicroUSDC, @walletAddress,
         @registeredAt, @latencyP50Ms, @latencyP95Ms, @successCount, @failureCount,
         @circuitState, @circuitOpenedAt, @consecutiveFailures
       )
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         endpoint = excluded.endpoint,
         capabilities = excluded.capabilities,
         advertised_price_micro_usdc = excluded.advertised_price_micro_usdc,
         wallet_address = excluded.wallet_address,
         latency_p50_ms = excluded.latency_p50_ms,
         latency_p95_ms = excluded.latency_p95_ms,
         success_count = excluded.success_count,
         failure_count = excluded.failure_count,
         circuit_state = excluded.circuit_state,
         circuit_opened_at = excluded.circuit_opened_at,
         consecutive_failures = excluded.consecutive_failures`
    )
    .run({
      id: p.id,
      name: p.name,
      endpoint: p.endpoint,
      capabilities: JSON.stringify(p.capabilities),
      advertisedPriceMicroUSDC: p.advertisedPriceMicroUSDC,
      walletAddress: p.walletAddress,
      registeredAt: p.registeredAt,
      latencyP50Ms: p.latencyP50Ms,
      latencyP95Ms: p.latencyP95Ms,
      successCount: p.successCount,
      failureCount: p.failureCount,
      circuitState: p.circuitState,
      circuitOpenedAt: p.circuitOpenedAt,
      consecutiveFailures: p.consecutiveFailures,
    });
}

/** Boot-time load — lets a restart resume with prior observed history instead of a cold cache. */
export function loadProviders(): Provider[] {
  const rows = db().prepare(`SELECT * FROM providers`).all() as ProviderRow[];
  return rows.map(rowToProvider);
}

/** Writes the decision row plus every candidate row (rejected ones included — PRD §9.5, hard rule 6). */
export function insertDecision(decision: RouteDecision, agentId?: string, priority: Priority = 'balanced'): void {
  const d = db();
  const insertDecisionStmt = d.prepare(
    `INSERT INTO decisions (id, request_id, capability, timestamp, selected_provider_id, reason, fallback_chain, agent_id, priority)
     VALUES (@id, @requestId, @capability, @timestamp, @selectedProviderId, @reason, @fallbackChain, @agentId, @priority)`
  );
  const insertCandidateStmt = d.prepare(
    `INSERT INTO candidates (
       decision_id, provider_id, provider_name, price_micro_usdc, expected_latency_ms,
       reliability_score, composite_score, eligible, ineligible_reason, rank
     ) VALUES (
       @decisionId, @providerId, @providerName, @priceMicroUSDC, @expectedLatencyMs,
       @reliabilityScore, @compositeScore, @eligible, @ineligibleReason, @rank
     )`
  );

  d.transaction(() => {
    insertDecisionStmt.run({
      id: decision.id,
      requestId: decision.requestId,
      capability: decision.capability,
      timestamp: decision.timestamp,
      selectedProviderId: decision.selectedProviderId || null,
      reason: decision.reason,
      fallbackChain: JSON.stringify(decision.fallbackChain),
      agentId: agentId ?? null,
      priority,
    });
    decision.candidates.forEach((c, rank) => {
      insertCandidateStmt.run({
        decisionId: decision.id,
        providerId: c.providerId,
        providerName: c.providerName,
        priceMicroUSDC: c.priceMicroUSDC,
        expectedLatencyMs: c.expectedLatencyMs,
        reliabilityScore: c.reliabilityScore,
        compositeScore: c.compositeScore,
        eligible: c.eligible ? 1 : 0,
        ineligibleReason: c.ineligibleReason ?? null,
        rank,
      });
    });
  })();
}

export function insertCall(call: CallRecord): void {
  db()
    .prepare(
      `INSERT INTO calls (id, decision_id, provider_id, started_at, completed_at, latency_ms, outcome, http_status, error_detail)
       VALUES (@id, @decisionId, @providerId, @startedAt, @completedAt, @latencyMs, @outcome, @httpStatus, @errorDetail)`
    )
    .run({
      id: call.id,
      decisionId: call.decisionId,
      providerId: call.providerId,
      startedAt: call.startedAt,
      completedAt: call.completedAt,
      latencyMs: call.latencyMs,
      outcome: call.outcome,
      httpStatus: call.httpStatus,
      errorDetail: call.errorDetail,
    });
}

export function insertPayment(payment: PaymentRecord): void {
  db()
    .prepare(
      `INSERT INTO payments (
         id, decision_id, provider_id, amount_micro_usdc, network, tx_ids, group_id,
         fee_sponsored, settled_at, finality_ms, status, explorer_url, created_at
       ) VALUES (
         @id, @decisionId, @providerId, @amountMicroUSDC, @network, @txIds, @groupId,
         @feeSponsored, @settledAt, @finalityMs, @status, @explorerUrl, @createdAt
       )`
    )
    .run({
      id: payment.id,
      decisionId: payment.decisionId,
      providerId: payment.providerId,
      amountMicroUSDC: payment.amountMicroUSDC,
      network: payment.network,
      txIds: JSON.stringify(payment.txIds),
      groupId: payment.groupId,
      feeSponsored: payment.feeSponsored ? 1 : 0,
      settledAt: payment.settledAt,
      finalityMs: payment.finalityMs,
      status: payment.status,
      explorerUrl: payment.explorerUrl,
      createdAt: Date.now(),
    });
}

interface DecisionRow {
  id: string;
  request_id: string;
  capability: string;
  timestamp: number;
  selected_provider_id: string | null;
  reason: string;
  fallback_chain: string;
  priority: Priority;
}

/** RouteDecision plus the additive `priority` field (see schema.sql) — not part of the PRD §8.3 contract, but the dashboard's weight chip needs it. */
export type DecisionWithPriority = RouteDecision & { priority: Priority };

interface CandidateRow {
  decision_id: string;
  provider_id: string;
  provider_name: string;
  price_micro_usdc: number;
  expected_latency_ms: number;
  reliability_score: number;
  composite_score: number;
  eligible: number;
  ineligible_reason: string | null;
}

/** Newest first, each with its full candidate set (rejected candidates included — hard rule 6). */
export function getRecentDecisions(limit = 50): DecisionWithPriority[] {
  const d = db();
  const decisionRows = d.prepare(`SELECT * FROM decisions ORDER BY timestamp DESC LIMIT ?`).all(limit) as DecisionRow[];
  if (decisionRows.length === 0) return [];

  const ids = decisionRows.map((r) => r.id);
  const placeholders = ids.map(() => '?').join(',');
  const candidateRows = d
    .prepare(`SELECT * FROM candidates WHERE decision_id IN (${placeholders}) ORDER BY decision_id, rank`)
    .all(...ids) as CandidateRow[];

  const candidatesByDecision = new Map<string, ScoredCandidate[]>();
  for (const c of candidateRows) {
    const list = candidatesByDecision.get(c.decision_id) ?? [];
    list.push({
      providerId: c.provider_id,
      providerName: c.provider_name,
      priceMicroUSDC: c.price_micro_usdc,
      expectedLatencyMs: c.expected_latency_ms,
      reliabilityScore: c.reliability_score,
      compositeScore: c.composite_score,
      eligible: c.eligible === 1,
      ineligibleReason: c.ineligible_reason ?? undefined,
    });
    candidatesByDecision.set(c.decision_id, list);
  }

  return decisionRows.map((r) => ({
    id: r.id,
    requestId: r.request_id,
    capability: r.capability,
    timestamp: r.timestamp,
    candidates: candidatesByDecision.get(r.id) ?? [],
    selectedProviderId: r.selected_provider_id ?? '',
    reason: r.reason,
    fallbackChain: JSON.parse(r.fallback_chain) as string[],
    priority: r.priority,
  }));
}

interface PaymentRow {
  id: string;
  decision_id: string;
  provider_id: string;
  amount_micro_usdc: number;
  network: PaymentRecord['network'];
  tx_ids: string;
  group_id: string | null;
  fee_sponsored: number;
  settled_at: number | null;
  finality_ms: number | null;
  status: PaymentRecord['status'];
  explorer_url: string | null;
}

function rowToPayment(row: PaymentRow): PaymentRecord {
  return {
    id: row.id,
    decisionId: row.decision_id,
    providerId: row.provider_id,
    amountMicroUSDC: row.amount_micro_usdc,
    network: row.network,
    txIds: JSON.parse(row.tx_ids) as string[],
    groupId: row.group_id,
    feeSponsored: row.fee_sponsored === 1,
    settledAt: row.settled_at,
    finalityMs: row.finality_ms,
    status: row.status,
    explorerUrl: row.explorer_url,
  };
}

/** Newest first. */
export function getRecentPayments(limit = 50): PaymentRecord[] {
  const rows = db().prepare(`SELECT * FROM payments ORDER BY created_at DESC LIMIT ?`).all(limit) as PaymentRow[];
  return rows.map(rowToPayment);
}

/** PRD §8.6, plus `avgSettlementMs` for the dashboard's "settles in" tile (not part of the binding SavingsSnapshot shape, additive like GET /health's chaosMode). */
export interface StatsSnapshot extends SavingsSnapshot {
  avgSettlementMs: number;
}

export function computeStats(): StatsSnapshot {
  const d = db();

  const totalRequests = (
    d.prepare(`SELECT COUNT(*) AS n FROM decisions WHERE selected_provider_id IS NOT NULL AND selected_provider_id != ''`).get() as {
      n: number;
    }
  ).n;

  const spentRow = d
    .prepare(`SELECT COALESCE(SUM(amount_micro_usdc), 0) AS total, COALESCE(AVG(finality_ms), 0) AS avgMs FROM payments WHERE status = 'settled'`)
    .get() as { total: number; avgMs: number };
  const totalSpentMicroUSDC = spentRow.total;
  const avgSettlementMs = Math.round(spentRow.avgMs);

  const paymentsRefused = (d.prepare(`SELECT COUNT(*) AS n FROM payments WHERE status = 'refused'`).get() as { n: number }).n;

  // "Routed around a failure" — a decision whose fallback chain tried more than one candidate.
  const chainRows = d.prepare(`SELECT fallback_chain FROM decisions`).all() as { fallback_chain: string }[];
  const requestsRerouted = chainRows.filter((r) => (JSON.parse(r.fallback_chain) as string[]).length > 1).length;

  // PRD §8.6: "cost if every request went to the most expensive provider" — per settled
  // payment's own decision, since that's the actual candidate set it chose among.
  const settledDecisionIds = d.prepare(`SELECT DISTINCT decision_id FROM payments WHERE status = 'settled'`).all() as {
    decision_id: string;
  }[];
  const maxPriceStmt = d.prepare(`SELECT MAX(price_micro_usdc) AS maxPrice FROM candidates WHERE decision_id = ?`);
  let naiveBaselineMicroUSDC = 0;
  for (const { decision_id } of settledDecisionIds) {
    const row = maxPriceStmt.get(decision_id) as { maxPrice: number | null };
    naiveBaselineMicroUSDC += row.maxPrice ?? 0;
  }

  const savedMicroUSDC = naiveBaselineMicroUSDC - totalSpentMicroUSDC;
  const savedPercent = naiveBaselineMicroUSDC > 0 ? Math.round((savedMicroUSDC / naiveBaselineMicroUSDC) * 100) : 0;

  return {
    totalRequests,
    totalSpentMicroUSDC,
    naiveBaselineMicroUSDC,
    savedMicroUSDC,
    savedPercent,
    requestsRerouted,
    paymentsRefused,
    avgSettlementMs,
  };
}

export function closeDb(): void {
  handle?.close();
  handle = null;
}
