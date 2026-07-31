-- Route402 ledger schema. Applied on boot if absent.
--
-- `providers` holds live health state and is mutable.
-- Everything else is APPEND-ONLY: rows are inserted, never rewritten, with the
-- single exception of defined status transitions on `payments`
-- (pending -> settled | failed | refused).

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ── providers (PRD §8.1) ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS providers (
  id                          TEXT    PRIMARY KEY,
  name                        TEXT    NOT NULL,
  endpoint                    TEXT    NOT NULL,
  capabilities                TEXT    NOT NULL,           -- JSON string[]
  advertised_price_micro_usdc INTEGER NOT NULL,
  wallet_address              TEXT    NOT NULL,
  registered_at               INTEGER NOT NULL,
  -- observed, not advertised:
  latency_p50_ms              INTEGER NOT NULL,
  latency_p95_ms              INTEGER NOT NULL,
  success_count               INTEGER NOT NULL DEFAULT 1, -- optimistic prior
  failure_count               INTEGER NOT NULL DEFAULT 0,
  circuit_state               TEXT    NOT NULL DEFAULT 'closed'
                                      CHECK (circuit_state IN ('closed','open','half_open')),
  circuit_opened_at           INTEGER,
  consecutive_failures        INTEGER NOT NULL DEFAULT 0
);

-- ── decisions (PRD §8.3) ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS decisions (
  id                   TEXT    PRIMARY KEY,
  request_id           TEXT    NOT NULL,
  capability           TEXT    NOT NULL,
  timestamp            INTEGER NOT NULL,
  selected_provider_id TEXT,                              -- null if nothing eligible
  reason               TEXT    NOT NULL,
  fallback_chain       TEXT    NOT NULL DEFAULT '[]',     -- JSON string[]
  agent_id             TEXT,
  -- Additive, not part of the PRD §8.3 RouteDecision contract (same pattern
  -- as GET /health's chaosMode): the dashboard's weight-profile chip (Phase
  -- 5, DESIGN.md §4.5) needs to know which priority actually scored this
  -- decision, or it would default to guessing "Balanced" for every row.
  priority             TEXT    NOT NULL DEFAULT 'balanced'
                                CHECK (priority IN ('cost','speed','balanced'))
);
CREATE INDEX IF NOT EXISTS idx_decisions_timestamp ON decisions(timestamp DESC);

-- ── candidates — one row per ScoredCandidate (PRD §8.3) ─────────────────────
-- Rejected candidates are stored too. Dropping them would make the decision
-- illegible, and legibility is the product.
CREATE TABLE IF NOT EXISTS candidates (
  decision_id         TEXT    NOT NULL REFERENCES decisions(id),
  provider_id         TEXT    NOT NULL,
  provider_name       TEXT    NOT NULL,
  price_micro_usdc    INTEGER NOT NULL,
  expected_latency_ms INTEGER NOT NULL,
  reliability_score   REAL    NOT NULL,
  composite_score     REAL    NOT NULL,
  eligible            INTEGER NOT NULL CHECK (eligible IN (0,1)),
  ineligible_reason   TEXT,
  rank                INTEGER NOT NULL,
  PRIMARY KEY (decision_id, provider_id)
);

-- ── calls (PRD §8.5) ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS calls (
  id           TEXT    PRIMARY KEY,
  decision_id  TEXT    NOT NULL REFERENCES decisions(id),
  provider_id  TEXT    NOT NULL,
  started_at   INTEGER NOT NULL,
  completed_at INTEGER,
  latency_ms   INTEGER,
  outcome      TEXT    NOT NULL
                       CHECK (outcome IN ('success','timeout','error','invalid_response')),
  http_status  INTEGER,
  error_detail TEXT
);
CREATE INDEX IF NOT EXISTS idx_calls_provider ON calls(provider_id, started_at DESC);

-- ── payments (PRD §8.4) ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payments (
  id                TEXT    PRIMARY KEY,
  decision_id       TEXT    NOT NULL REFERENCES decisions(id),
  provider_id       TEXT    NOT NULL,
  amount_micro_usdc INTEGER NOT NULL,
  network           TEXT    NOT NULL CHECK (network IN ('testnet','mainnet')),
  tx_ids            TEXT    NOT NULL DEFAULT '[]',        -- JSON string[]
  group_id          TEXT,                                 -- Algorand group id when grouped
  fee_sponsored     INTEGER NOT NULL DEFAULT 0 CHECK (fee_sponsored IN (0,1)),
  settled_at        INTEGER,
  finality_ms       INTEGER,                              -- submit -> confirmed
  status            TEXT    NOT NULL
                            CHECK (status IN ('pending','settled','failed','refused')),
  explorer_url      TEXT,
  created_at        INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_payments_created ON payments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_provider ON payments(provider_id);
