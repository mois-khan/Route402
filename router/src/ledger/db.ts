import Database from 'better-sqlite3';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { config } from '../config.js';

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

export function closeDb(): void {
  handle?.close();
  handle = null;
}
