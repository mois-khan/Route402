# Route402 — Implementation Plan

Derived from [PRD.md](PRD.md). The PRD defines *what* and *why*. This document defines *in what order* and *what "done" means per step*.

| Field | Value |
|---|---|
| Budget | 2 days (~16 working hours) |
| Sequencing | Strictly sequential. A phase does not start until the previous phase runs end to end. |
| Status source of truth | `PROJECT_STATE` in [index.html](index.html) |

---

## Target repository layout

Established in Phase 0, referenced by every later phase. Do not relocate files without updating this table.

```
route402/
├── CLAUDE.md                    # agent rules (root, always in context)
├── package.json                 # npm workspaces + concurrently scripts
├── .env.example                 # every key the system reads, no secrets
├── docs/
│   ├── PRD.md                   # source of truth for scope
│   ├── IMPLEMENTATION_PLAN.md   # this file
│   ├── VERIFY.md                # resolved [VERIFY] findings (Phase 3)
│   └── index.html               # project overview + live progress
├── shared/
│   └── src/types.ts             # PRD §8 interfaces — binding, single copy
├── router/
│   └── src/
│       ├── index.ts             # Fastify bootstrap, route registration
│       ├── registry.ts          # provider pool, health, circuit state
│       ├── scorer.ts            # PURE. no I/O. PRD §9
│       ├── explain.ts           # explainDecision(decision) → string
│       ├── breaker.ts           # trip / half-open / recover
│       ├── payment/
│       │   ├── x402.ts          # 402 handshake, header construction
│       │   ├── algorand.ts      # algosdk: txn build, group, sign, submit
│       │   └── guard.ts         # delivery verification, refusal
│       ├── ledger/
│       │   ├── db.ts            # better-sqlite3 handle + queries
│       │   └── schema.sql       # tables for PRD §8 records
│       └── routes/
│           ├── route.ts         # POST /v1/route
│           ├── providers.ts     # POST/GET /v1/providers, chaos
│           ├── decisions.ts     # GET /v1/decisions
│           ├── stats.ts         # GET /v1/stats
│           └── events.ts        # WS /v1/events
├── providers/
│   └── src/
│       ├── server.ts            # one Express template
│       ├── profiles.ts          # alpha / beta / gamma config
│       ├── chaos.ts             # offline | slow | garbage | healthy
│       └── x402-gate.ts         # 402 response + payment verification
├── agent/
│   └── src/
│       ├── cli.ts               # single request, prints routing + payment
│       └── load.ts              # N-request load generator
└── dashboard/
    └── src/                     # React + Vite + Tailwind, single page
```

---

## Phase table

| # | Phase | Est. | Day | Gate |
|---|---|---|---|---|
| 0 | Foundation | 1h | 1 | `npm run dev` boots everything |
| 1 | Providers | 1.5h | 1 | 3 providers respond, chaos works |
| 2 | Registry + Scorer | 2h | 1 | Correct pick under all 3 priority profiles |
| 3 | x402 integration | 3h | 1 | One real TestNet settlement, explorer link resolves |
| 4 | Guard + fallback | 1h | 1 | Killed provider → reroute, no payment |
| 5 | Dashboard | 3h | 2 | 20 requests update everything live |
| 6 | Algorand differentiators | 2h | 2 | Fee abstraction + atomic composite both work |
| 7 | MainNet + polish | 1.5h | 2 | Linkable MainNet transaction |
| 8 | Demo rehearsal | 1.5h | 2 | Three consecutive clean runs |

---

## Phase 0 — Foundation

**Goal:** a skeleton that boots. No business logic.

- [x] Root `package.json` with npm workspaces: `shared`, `router`, `providers`, `agent`, `dashboard`
- [x] TypeScript config: strict mode on, `shared` path-aliased from every workspace
- [x] `shared/src/types.ts` — transcribe PRD §8 verbatim. `Provider`, `RouteRequest`, `RouteDecision`, `ScoredCandidate`, `PaymentRecord`, `CallRecord`, `SavingsSnapshot`
- [x] `router/src/ledger/schema.sql` — tables `providers`, `decisions`, `candidates`, `calls`, `payments`. Append-only; no UPDATE on decisions or payments except status transitions
- [x] `router/src/ledger/db.ts` — open SQLite, apply schema on boot if absent
- [x] Fastify server on `:4000` with `GET /health`
- [x] Express provider stub on `:4001` with `GET /health` (three instances: `:4001–:4003`, ahead of Phase 1's profiles since one template serves all three)
- [x] Vite + React + Tailwind shell on `:5173`
- [x] `.env.example` with every key, all values empty
- [x] `.gitignore` — `.env`, `node_modules`, `*.db`, `dist`, plus demo recordings and editor/OS cruft
- [x] Root script `npm run dev` via `concurrently`, colour-labelled per service

**Exit:** one command starts router + 3 providers + dashboard; all health checks return 200. ✅ Verified via `npm run health` — 5/5 up.

**Watch for:** Do not write routing logic here. The temptation is to "just add the scorer while I'm in there." Phase 0 is plumbing only.

---

## Phase 1 — Providers

**Goal:** three fake services with distinct, believable economics. No blockchain yet.

- [x] `providers/src/profiles.ts`:

  | id | name | price (µUSDC) | latency p50 | character |
  |---|---|---|---|---|
  | `prov_alpha` | Alpha Summarize | 8,000 | 1400ms | cheap, slow |
  | `prov_beta` | Beta Summarize | 12,000 | 700ms | mid, mid |
  | `prov_gamma` | Gamma Summarize | 22,000 | 250ms | expensive, fast |

- [x] `providers/src/server.ts` — one template, config-injected, three instances on `:4001–:4003`
- [x] Implement `text.summarize` with realistic jitter (±25% around p50), not a fixed sleep
- [x] `POST /<capability-path>` returns `{ summary: string }`
- [x] `GET /health` returns `{ status, capability, priceMicroUSDC }`
- [x] `providers/src/chaos.ts` — four modes:
  - `offline` — connection refused / 503
  - `slow` — 3× declared p95, past the timeout
  - `garbage` — 200 OK with an empty or malformed body (this is what proves the guard)
  - `healthy` — reset
- [x] `POST /_chaos` on each provider (router-side proxy at `POST /v1/providers/:id/chaos` deferred to Phase 2, once `registry.ts` has the provider id → endpoint map to proxy through)
- [x] Price header on the response so the router has something to read pre-x402

**Exit:** `curl` each provider, get a result; flip each chaos mode and observe the correct failure shape. ✅ Verified manually — healthy call ~1.6s within Alpha's jitter band, `garbage` → 200 with empty summary, `offline` → 503, `slow` → ~6.1s past the 4s declared timeout. Beta and Gamma boot with correct distinct profiles.

**Watch for:** `garbage` mode must return HTTP 200. A provider that fails loudly is easy. The interesting case — the one the guard exists for — is a provider that returns success with nothing in it.

---

## Phase 2 — Registry + Scorer

**Goal:** the intelligence. This is the phase judges will ask to see the code for.

- [x] `router/src/registry.ts` — in-memory provider map, write-through to SQLite
  - [x] `getCandidates(capability)` returns all providers declaring the capability, regardless of eligibility
  - [x] Rolling latency window (last 20 calls) → p50 / p95
  - [x] Cold-start seeding per PRD §9.6: optimistic prior `successCount = 1, failureCount = 0`
- [x] `router/src/scorer.ts` — **pure function**, signature `score(candidates, constraints) → ScoredCandidate[]`
  - [x] Eligibility filter first (PRD §9.5), rejected candidates retained with `eligible: false` + `ineligibleReason`
  - [x] Min-max normalisation with `max === min → 0` divide-by-zero guard
  - [x] Weight profiles: `cost` 0.65/0.10/0.25, `speed` 0.10/0.65/0.25, `balanced` 0.35/0.35/0.30
  - [x] `recentFailurePenalty = min(consecutiveFailures * 0.15, 0.45)`
  - [x] Lowest composite wins
- [x] `router/src/explain.ts` — `explainDecision(decision) → string`. Generated from the score deltas, never hand-templated per call site
- [x] `router/src/breaker.ts` — trip at 3 consecutive failures, `half_open` probe after 30s, one probe at a time, success closes / failure re-opens
- [x] Test harness: `npm run scorer:table` prints the full score matrix for the three providers under all three priorities
- [x] Unit tests for the scorer only (PRD §16 — no other test coverage)

**Exit:** under `cost` Alpha wins; under `speed` Gamma wins; under `balanced` Beta wins. Every decision explains itself in one sentence. ✅ Verified via `npm run scorer:table` — Alpha/Gamma/Beta win their respective priorities, plus a circuit-open scenario proving the exclusion-reason branch. `npm test` — 14/14 scorer unit tests pass. `registry.ts`/`breaker.ts` manually verified (cold start, rolling window, breaker trip/half-open/recover, one-probe-at-a-time, SQLite persistence round-trip) via a throwaway script, since PRD §16 restricts automated coverage to the scorer.

**Watch for:** The scorer must not import the registry, the DB, or anything async. Purity is what makes it demonstrable on stage.

---

## Phase 3 — x402 integration ⚠ RISK PHASE

**Goal:** one real payment settles on Algorand TestNet.

**Timebox: 3 hours. Hard stop.**

### 3a — Verify before writing code (45 min, non-negotiable)

Every `[VERIFY]` marker in the PRD resolves here. Record findings in `docs/VERIFY.md` with the URL and date checked.

- [ ] Exact npm package names + versions for Algorand x402 (GoPlausible / Coinbase x402 spec)
- [ ] Exact `accepts[]` field names in the 402 response body — do not guess from PRD §10.2
- [ ] Payment header name and payload encoding
- [ ] Facilitator verify/settle endpoint URLs for TestNet
- [ ] USDC ASA ID for TestNet **and** MainNet
- [ ] Whether the facilitator or the router submits the transaction
- [ ] TestNet dispenser for ALGO; source for TestNet USDC

### 3b — Provider side

- [ ] `providers/src/x402-gate.ts` — unpaid request returns real 402 with the verified body shape
- [ ] Verify presented payment against the facilitator; on success serve the result

### 3c — Router side

- [ ] `router/src/payment/algorand.ts` — algosdk client, USDC ASA transfer construction, sign, submit, wait for confirmation, measure finality ms
- [ ] `router/src/payment/x402.ts` — call unpaid → parse 402 → **validate quote against `maxPriceMicroUSDC`** → build payment → retry with header
- [ ] Quote-exceeds-advertised is a fraud signal: abort, re-route, record it. Do not pay
- [ ] Write `PaymentRecord` with `txIds`, `finalityMs`, `explorerUrl`

**Exit:** one request end to end, real settlement, explorer link opens a real transaction.

**Contingency (read this before starting):** if 3a reveals the tooling is unusable or undocumented, implement the 402 handshake directly against raw `algosdk` — the spec is public and the transaction is an ordinary ASA transfer. If Phase 3 is not done when the timebox expires, **freeze it, ship Phases 4–5 on whatever payment path works, and return only if Day 2 has slack.** A working simple payment beats a broken sophisticated one. Atomic grouping is Phase 6 and is cuttable.

---

## Phase 4 — Guard + fallback

**Goal:** a provider that does not deliver is not paid.

- [ ] `router/src/payment/guard.ts` — verify before settlement counts as valid (PRD §11.3):
  - [ ] HTTP status 2xx
  - [ ] Body parses as JSON
  - [ ] Expected capability output field present and non-empty
  - [ ] Arrived within declared `maxTimeoutSeconds`
- [ ] Any check fails → `PaymentRecord.status = 'refused'`, failure recorded against provider, request re-routed
- [ ] Fallback loop: next-best eligible candidate, **max 3 attempts**, every attempt appended to `fallbackChain`
- [ ] Error responses: 402 `no_affordable_provider`, 503 `no_provider_available`, with the exact bodies from PRD §10.1

**Exit:** set Beta to `garbage` mid-request; the request still returns a good result via another provider, and Beta's earnings do not increase.

---

## Phase 5 — Dashboard

**Goal:** the thing on the projector. Readable from the back of the room.

- [ ] `WS /v1/events` broadcasting `decision | payment | call | circuit | stats`
- [ ] Client WebSocket with auto-reconnect (venue wifi will flake)
- [ ] **Row 1 — headline metrics.** Requests routed · total spent · **saved vs. naive** (largest element on the page, with %) · avg settlement ms
- [ ] **Row 2 — provider health strip.** Per card: name, capability, price, circuit state as colour + word, p95, success rate, total earned, sparkline of last 20 calls
- [ ] **Row 3 — live decision feed.** Newest at top, animates in. Reason string always visible; expands to all candidates with scores — **including rejected ones with reasons**
- [ ] **Row 4 — settlement ledger.** Amount, provider, finality, `refused` badge, clickable explorer link
- [ ] Savings calculation per PRD §8.6 — naive baseline is "every request to the most expensive provider"
- [ ] Simulation controls panel, visually separated and explicitly labelled so no judge mistakes it for routing logic

**Exit:** fire 20 requests; every row updates live without a refresh.

**Watch for:** The rejected candidates are the demo. A feed that only shows the winner shows nothing.

---

## Phase 6 — Algorand differentiators

**Goal:** the answer to "why not any other chain?"

- [ ] **Fee abstraction (US9).** Agent wallet holds USDC and **zero ALGO**. Sponsor wallet covers fees for the group. Assert the zero balance on the dashboard so it is visible, not claimed
- [ ] **Composite request (US8).** One agent call requiring two capabilities → both payments in one atomic group → both settle or neither does
- [ ] Second capability on the providers (`text.translate`) to make composite meaningful
- [ ] Label both explicitly in the UI — an atomic group badge on the settlement row, a "0 ALGO" badge on the agent

**Exit:** both demonstrable on demand, both visible in the UI without narration.

**Cut order if Day 2 runs short:** cut Phase 6 before cutting Phase 8. A rehearsed demo of Phases 0–5 beats an unrehearsed demo with atomic groups.

---

## Phase 7 — MainNet + polish

**Status: optional stretch goal.** Decided 2026-07-31 — MainNet needs a KYC'd exchange account for real ALGO/USDC, which can take 1-2 days to clear against a 2-day budget. Ranked with Phase 6 for cutting: if Day 2 is tight, skip this phase and ship on TestNet only. Phases 5 and 8 stay protected regardless.

- [ ] MainNet config path, tiny real amounts, keys local only and never committed
- [ ] Deploy the router endpoint publicly
- [ ] GoPlausible facilitator registration for the public x402 leaderboard (`[VERIFY]` the process)
- [ ] One real MainNet transaction, link captured
- [ ] README: what it is, one-command run, architecture diagram
- [ ] Pre-flight script: check wallet balances and ASA IDs on both networks, fail loudly

**Exit:** a MainNet transaction exists and its explorer link is in the README.

---

## Phase 8 — Demo rehearsal

- [ ] Seed script: ~200 prior requests so savings and spend read as substantial on open
- [ ] Run PRD §14 end to end, timed, three times
- [ ] Explorer tab pre-opened; terminal font sized for a projector
- [ ] **Record a full clean run as video** — this is the wifi-failure insurance
- [ ] Local-only mode: everything except settlement, for total network loss
- [ ] Screenshots of each dashboard row as last-resort fallback

**Exit:** three consecutive clean runs, under 4 minutes each.

---

## Acceptance criteria

Copied from PRD §18. The build is done when every line is true.

- [ ] Agent calls one endpoint, gets a result, never learns the provider
- [ ] Three providers with distinct price/latency profiles, registered and routable
- [ ] Every request produces a `RouteDecision` listing all candidates, rejected ones included with reasons
- [ ] Every success produces a real, explorer-verifiable Algorand settlement
- [ ] `maxPriceMicroUSDC` is never exceeded
- [ ] Killing a provider mid-traffic reroutes with no human intervention
- [ ] A failed provider is never paid, and the refusal is visible in the UI
- [ ] Fee abstraction demonstrated: agent wallet holds zero ALGO
- [ ] Composite request demonstrated: two providers, one atomic group
- [ ] Dashboard shows savings vs. naive routing, live
- [ ] Route402 endpoint live on MainNet
- [ ] Demo runs clean three consecutive times

---

## Standing risks

| Risk | Trigger to watch | Response |
|---|---|---|
| Phase 3 overruns | 3h timebox expires | Freeze, ship 4–5 on the working path, revisit only with slack |
| Wrong ASA ID / unfunded wallet | Any settlement failure | Pre-flight script, run at Phase 3 start and again before the demo |
| Venue wifi fails | — | Recorded video + local-only mode, both ready by end of Phase 8 |
| Savings number reads trivial | Counter under ~10% | Seed more history; lead with percentage, not absolute |
| Scope creep | Any work not in a phase above | PRD §2.4 and §16 are binding. Delete it |
| Day-2 fatigue | — | Phases 5 and 8 are the demo. Protect them at the cost of Phase 6 and Phase 7 |
| MainNet KYC doesn't clear in time | Exchange verification still pending when Phase 7 starts | Skip Phase 7 entirely, ship and demo on TestNet only — MainNet is a stretch goal, not an acceptance blocker for the demo itself |
