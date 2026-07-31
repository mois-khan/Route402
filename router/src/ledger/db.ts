import Database from 'better-sqlite3';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { config } from '../config.js';
import type { Provider } from '@route402/shared';

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

export function closeDb(): void {
  handle?.close();
  handle = null;
}
