# Route402 — Product Requirements Document

| Field | Value |
|---|---|
| Project | Route402 |
| Track | Track 2 — Composite Entry (Agent Payment Router) |
| Event | NexVerse — Algo + AI Hackathon, Algorand Blockchain Club, Aurora University |
| Duration | 2 days |
| Team | Mois Khan (solo) |
| Chain | Algorand (TestNet for dev, MainNet for final endpoint) |
| Payment protocol | x402 |
| Status | Draft v1 — pre-build |

---

## 0. How to use this document

This PRD is the single source of truth for the build. It is written to be fed directly to an AI coding agent (Claude Code) as persistent context.

**Rules for the implementing agent:**

1. Read Sections 1–3 before writing any code. They define what "done" means.
2. Section 8 (Data Models) and Section 10 (API Contracts) are binding. Do not invent alternate field names.
3. Section 13 (Build Phases) is the execution order. Do not build ahead of the current phase.
4. Anything marked `[VERIFY]` must be checked against live documentation before implementing — the exact package names and function signatures of the Algorand x402 tooling are fast-moving and must not be assumed.
5. Anything in Section 16 (Out of Scope) is forbidden. Building it costs the demo.

---

## 1. Problem statement

### 1.1 The situation

AI agents increasingly need to consume paid third-party services — inference, transcription, embeddings, search, data enrichment — at machine speed and machine frequency.

Today, consuming a paid API requires a human to create an account, provision an API key, attach a credit card, and reconcile a monthly invoice. This is workable for one provider. It is structurally impossible across twenty providers, and it is completely impossible for a provider the agent discovered thirty seconds ago.

The result: agents are hard-wired to a single provider chosen by a human at build time. That single provider is, at any given moment, probably not the cheapest, probably not the fastest, and occasionally down.

### 1.2 What x402 changes

x402 turns HTTP `402 Payment Required` into a working payment negotiation. A client requests a resource, receives a 402 with price and payment requirements, attaches a signed payment, and retries. The server verifies settlement and serves the resource.

No account. No API key. No invoice. Payment is a property of the request.

This removes the only reason agents were locked to a single provider — and immediately creates a new problem that did not previously exist: **with the switching cost gone, something has to decide which provider to use, per request, in real time.**

### 1.3 What Route402 is

Route402 is that decision layer. It is an x402-native routing and settlement layer that sits between an AI agent and a pool of paid services.

An agent sends one request to Route402. Route402 evaluates every registered provider capable of fulfilling it, scores them on live price, latency and reliability, selects one, constructs and settles the x402 payment on Algorand, returns the result, and updates its own model of the provider pool based on what just happened.

The agent holds no accounts, manages no keys, and never chooses a provider.

### 1.4 One-line pitch

> AI agents can now pay for services on their own. Nobody's telling them which one to pick. Route402 does.

---

## 2. Goals and non-goals

### 2.1 Primary goals

| # | Goal | Success looks like |
|---|---|---|
| G1 | Route a request across ≥3 competing paid services and pick the best one | Judge sees the decision and its reasoning, live |
| G2 | Settle every routed request with a real x402 payment on Algorand | Explorer link resolves to a real transaction |
| G3 | Detect and route around a failing provider without human intervention | Provider is killed mid-demo; traffic reroutes within one request |
| G4 | Prove economic value | Dashboard shows cumulative cost saved vs. naive single-provider routing |
| G5 | Use Algorand-specific capability, not generic x402 | Atomic transaction grouping and fee abstraction both demonstrated |

### 2.2 Secondary goals

- Deploy the Route402 endpoint to Algorand MainNet and register with the GoPlausible facilitator so it appears on the public x402 leaderboard. This is a strong credibility signal and outlives the hackathon. `[VERIFY]` registration process.
- Produce a clean README and architecture diagram in-repo.

### 2.3 Non-goals

- Not building a general marketplace with third-party sellers.
- Not building user accounts, auth, or a billing dashboard.
- Not building a production-grade provider SDK.
- Not achieving real cost savings against real commercial APIs — simulated providers with realistic profiles are acceptable and expected.

### 2.4 Explicit anti-goals

Time spent on these is time stolen from the demo: landing pages, logo animation, dark-mode toggles, user registration, mobile responsiveness, Docker orchestration, CI pipelines, unit test coverage targets.

---

## 3. Judging alignment

The build must be legible to judges from the Algorand Blockchain Club. Every feature below maps to something they will score.

| Judge question | Route402's answer |
|---|---|
| Is x402 the product, or a paywall bolted on? | Remove x402 and there is no product. Routing exists only because payment became stateless. |
| Did they use Algorand, or any chain? | Atomic transaction groups make multi-provider requests all-or-nothing. Fee abstraction lets the router sponsor gas so the calling agent holds zero ALGO. Instant finality is why routing can happen inside a synchronous HTTP request. |
| Does it work, or is it a mockup? | Live traffic, live settlement, explorer links, a provider killed on stage. |
| Is it agentic? | No human in the loop. The agent does not know which provider served it. |
| Does it matter? | Cost-saved counter, ticking up in rupees/USDC during the demo. |

**Demo-critical invariant:** at no point during the demo should the presenter click something that a real agent would not. If a human has to intervene, the thesis is dead.

---

## 4. Glossary

| Term | Meaning |
|---|---|
| **Agent** | The client. Any program that needs a task done and calls Route402 instead of a provider. |
| **Provider** | A paid service exposing an x402-protected endpoint. Also "resource server" in x402 terminology. |
| **Capability** | A normalised task type, e.g. `text.summarize`. Providers register against capabilities; routing happens within a capability. |
| **Facilitator** | The service that verifies and settles x402 payments. GoPlausible operates the Algorand facilitator. |
| **Atomic group** | Algorand's native primitive for grouping transactions so that all succeed or all fail. No partial execution. |
| **Fee abstraction** | Grouping a payment transaction with a fee transaction from a third-party payer, so the payer of the fee is not the payer of the payment. |
| **ASA** | Algorand Standard Asset. USDC on Algorand is an ASA. |
| **Route decision** | The immutable record of why a given provider was selected for a given request. |
| **Circuit breaker** | The mechanism that removes a misbehaving provider from consideration and later probes whether it has recovered. |

---

## 5. Users and use cases

### 5.1 Primary user — the calling agent

An autonomous program that needs a capability fulfilled and does not want to reason about providers.

**It needs:** one stable endpoint, a predictable response shape, a cost ceiling it can express per request, and a guarantee it is never charged for a result it did not receive.

**It does not need:** provider names, pricing tables, retry logic, or a wallet balance in ALGO.

### 5.2 Secondary user — the provider

A developer who has built something useful and wants to be paid per call without building billing.

**It needs:** to be discoverable, to be paid on delivery, and to be judged fairly on performance.

### 5.3 Tertiary user — the operator (demo persona)

The person watching the dashboard. Needs to see what is happening and why, in real time.

### 5.4 Core user stories

| ID | Story | Priority |
|---|---|---|
| US1 | As an agent, I send one request and get a result without knowing which provider served it | P0 |
| US2 | As an agent, I set `max_price` and am never charged above it | P0 |
| US3 | As an agent, I set `priority: speed` and the router weights latency over cost | P0 |
| US4 | As an agent, I am not charged when a provider fails to deliver | P0 |
| US5 | As an operator, I see every route decision and the score that drove it | P0 |
| US6 | As an operator, I see cumulative spend and cumulative savings vs. naive routing | P0 |
| US7 | As an operator, I watch a failing provider get circuit-broken and traffic reroute | P0 |
| US8 | As an agent, I request a composite task spanning two providers and pay both atomically or neither | P1 |
| US9 | As an agent, I hold zero ALGO and the router sponsors my transaction fee | P1 |
| US10 | As a provider, I self-register via API and start receiving traffic | P2 |

---

## 6. System architecture

### 6.1 Components

```
┌─────────────────────────────────────────────────────────────┐
│                        Agent (client)                        │
│              CLI demo harness + load generator               │
└───────────────────────────┬─────────────────────────────────┘
                            │  POST /v1/route
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                     ROUTE402 CORE                            │
│                                                              │
│  ┌────────────┐  ┌─────────────┐  ┌──────────────────────┐ │
│  │  Registry  │─▶│   Scorer    │─▶│   Payment Executor   │ │
│  │            │  │             │  │                      │ │
│  │ providers  │  │ price       │  │ x402 handshake       │ │
│  │ capability │  │ latency     │  │ atomic group build   │ │
│  │ health     │  │ reliability │  │ fee sponsorship      │ │
│  └────────────┘  └─────────────┘  └──────────┬───────────┘ │
│         ▲                                     │             │
│         │        ┌─────────────────┐          │             │
│         └────────│ Guard / Breaker │◀─────────┘             │
│                  │ verify delivery │                        │
│                  │ trip on failure │                        │
│                  └─────────────────┘                        │
│                            │                                 │
│                  ┌─────────▼─────────┐                       │
│                  │  Ledger (SQLite)  │                       │
│                  │ decisions, calls  │                       │
│                  └───────────────────┘                       │
└───────────┬─────────────────────────────┬───────────────────┘
            │ x402 request + payment      │ WebSocket events
            ▼                             ▼
┌───────────────────────┐      ┌─────────────────────────────┐
│  Provider A / B / C   │      │      Dashboard (React)      │
│  x402-gated endpoints │      │  live feed, savings, chain  │
└───────────┬───────────┘      └─────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────┐
│              Algorand + GoPlausible facilitator              │
│                verification and settlement                   │
└─────────────────────────────────────────────────────────────┘
```

### 6.2 Component responsibilities

**Registry** — owns the provider list. Knows every provider's capabilities, advertised price, observed latency (rolling p50/p95), observed success rate, and current circuit state. Exposes `getCandidates(capability)`.

**Scorer** — pure function. Takes candidates plus request constraints, returns a ranked list with a human-readable reason string per candidate. No side effects, no I/O. This must be independently testable and independently explainable on stage.

**Payment Executor** — performs the x402 handshake against the selected provider, constructs the Algorand transaction group, sponsors fees where applicable, submits, waits for finality, and returns the provider response plus settlement metadata.

**Guard / Breaker** — validates that the provider actually delivered something usable. On failure, records it, trips the breaker if thresholds are crossed, and signals the router to re-route. Owns the rule that a tripped provider is not paid again.

**Ledger** — append-only record of every decision, call, payment, and failure. Source of truth for the dashboard and for the savings calculation.

**Dashboard** — read-only view over the ledger plus a live WebSocket event stream.

---

## 7. Tech stack

Decided. Do not substitute without reason.

| Layer | Choice | Rationale |
|---|---|---|
| Language | TypeScript (Node 20+) | The x402 and Algorand tooling is JS/TS-first. One language across router, providers, and dashboard. |
| Router framework | Fastify | Lower ceremony than NestJS for a 2-day build; native async, easy WebSocket. |
| Provider framework | Express | Trivially small; three near-identical services. |
| Chain SDK | `algosdk` | Official Algorand JS SDK. |
| x402 | Algorand x402 packages via GoPlausible / Coinbase x402 spec | `[VERIFY]` exact package names and version at build time against the Algorand x402 docs. |
| Storage | SQLite via `better-sqlite3` | Zero network dependency during the demo. Synchronous API removes an entire class of race conditions. |
| Dashboard | React + Vite + Tailwind | Fast, familiar, no build ceremony. |
| Live updates | Native WebSocket (`ws`) | No Socket.io overhead needed. |
| Charts | Recharts | Two charts only. |
| Process runner | `concurrently` | One command starts router, three providers, and dashboard. |

**Networks:** develop against Algorand TestNet. Deploy the final Route402 endpoint to MainNet with tiny real amounts before submission.

**Asset:** USDC ASA on Algorand for all pricing. `[VERIFY]` correct asset ID per network.

---

## 8. Data models

These field names are binding.

### 8.1 Provider

```ts
interface Provider {
  id: string;                    // "prov_alpha"
  name: string;                  // "Alpha Summarize"
  endpoint: string;              // "http://localhost:4001/summarize"
  capabilities: string[];        // ["text.summarize"]
  advertisedPriceMicroUSDC: number;  // price per call, in micro-units
  walletAddress: string;         // Algorand address to be paid
  registeredAt: number;          // epoch ms
  // observed, not advertised:
  latencyP50Ms: number;
  latencyP95Ms: number;
  successCount: number;
  failureCount: number;
  circuitState: 'closed' | 'open' | 'half_open';
  circuitOpenedAt: number | null;
  consecutiveFailures: number;
}
```

`circuitState` semantics: `closed` = healthy and routable. `open` = excluded from routing. `half_open` = eligible for a single probe request.

### 8.2 RouteRequest

```ts
interface RouteRequest {
  capability: string;            // "text.summarize"
  payload: Record<string, any>;  // passed through to provider untouched
  constraints?: {
    maxPriceMicroUSDC?: number;  // hard ceiling; never exceeded
    maxLatencyMs?: number;       // soft preference
    priority?: 'cost' | 'speed' | 'balanced';  // default 'balanced'
    excludeProviders?: string[];
  };
  agentId?: string;              // for attribution only
}
```

### 8.3 RouteDecision

The most important object in the system. This is what gets shown on stage.

```ts
interface RouteDecision {
  id: string;                    // "dec_..."
  requestId: string;
  capability: string;
  timestamp: number;
  candidates: ScoredCandidate[]; // ALL candidates, including rejected
  selectedProviderId: string;
  reason: string;                // one-sentence human explanation
  fallbackChain: string[];       // provider ids attempted, in order
}

interface ScoredCandidate {
  providerId: string;
  providerName: string;
  priceMicroUSDC: number;
  expectedLatencyMs: number;
  reliabilityScore: number;      // 0..1
  compositeScore: number;        // lower is better
  eligible: boolean;
  ineligibleReason?: string;     // "circuit open" | "exceeds max price" | ...
}
```

### 8.4 PaymentRecord

```ts
interface PaymentRecord {
  id: string;
  decisionId: string;
  providerId: string;
  amountMicroUSDC: number;
  network: 'testnet' | 'mainnet';
  txIds: string[];               // all txns in the group
  groupId: string | null;        // Algorand group id when grouped
  feeSponsored: boolean;
  settledAt: number | null;
  finalityMs: number | null;     // submit -> confirmed
  status: 'pending' | 'settled' | 'failed' | 'refused';
  explorerUrl: string | null;
}
```

`refused` = the guard blocked payment because delivery failed verification. This status existing at all is a differentiator; make it visible in the UI.

### 8.5 CallRecord

```ts
interface CallRecord {
  id: string;
  decisionId: string;
  providerId: string;
  startedAt: number;
  completedAt: number | null;
  latencyMs: number | null;
  outcome: 'success' | 'timeout' | 'error' | 'invalid_response';
  httpStatus: number | null;
  errorDetail: string | null;
}
```

### 8.6 SavingsSnapshot

Computed, not stored per-row.

```ts
interface SavingsSnapshot {
  totalRequests: number;
  totalSpentMicroUSDC: number;
  naiveBaselineMicroUSDC: number;   // cost if every request went to the
                                     // most expensive provider
  savedMicroUSDC: number;
  savedPercent: number;
  requestsRerouted: number;          // saved by circuit breaker
  paymentsRefused: number;
}
```

---

## 9. Routing algorithm

### 9.1 Design principle

The algorithm must be simple enough to explain in fifteen seconds and defend under questioning. Arithmetic, not machine learning. The sophistication lives in *which* factors are weighed and in the honesty of the reliability term — not in model complexity.

### 9.2 Scoring

For each candidate, normalise each factor to 0..1 across the candidate set, then combine:

```
normPrice   = (price - minPrice) / (maxPrice - minPrice)      // 0 = cheapest
normLatency = (p95 - minP95) / (maxP95 - minP95)              // 0 = fastest
reliability = successCount / (successCount + failureCount)     // 1 = perfect
unreliability = 1 - reliability

compositeScore =
    (Wp * normPrice)
  + (Wl * normLatency)
  + (Wr * unreliability)
  + recentFailurePenalty
```

Lowest `compositeScore` wins.

Guard against divide-by-zero when all candidates share a value: if `max == min`, that normalised term is 0 for all.

### 9.3 Weight profiles

| priority | Wp (price) | Wl (latency) | Wr (reliability) |
|---|---|---|---|
| `cost` | 0.65 | 0.10 | 0.25 |
| `speed` | 0.10 | 0.65 | 0.25 |
| `balanced` (default) | 0.35 | 0.35 | 0.30 |

Reliability never drops below 0.25 in any profile. A cheap provider that does not deliver is not cheap.

### 9.4 Recent failure penalty

```
recentFailurePenalty = min(consecutiveFailures * 0.15, 0.45)
```

Applies before the circuit trips. A provider that just failed once is deprioritised but not exiled — this creates visible, gradual degradation in the demo rather than a binary cliff.

### 9.5 Eligibility filter (runs before scoring)

A candidate is ineligible if any of:

1. Does not declare the requested capability.
2. `circuitState === 'open'`.
3. `advertisedPrice > constraints.maxPriceMicroUSDC`.
4. Listed in `constraints.excludeProviders`.

Ineligible candidates are still returned in `candidates[]` with `eligible: false` and a populated `ineligibleReason`. **They must appear in the dashboard.** Showing rejected options is what makes the decision legible.

### 9.6 Cold start

A newly registered provider has no observed history. Seed with:

```
latencyP50Ms = advertised or 1000
latencyP95Ms = latencyP50Ms * 2
successCount = 1, failureCount = 0   // optimistic prior
```

Optimistic priors mean new providers get sampled. Note this in the pitch — it is the exploration/exploitation tradeoff and judges who know it will notice you handled it.

### 9.7 Fallback

If the selected provider fails (timeout, error, invalid response), the router immediately attempts the next-best eligible candidate. Maximum 3 attempts per request. Every attempt is appended to `fallbackChain`. The failed provider is not paid.

### 9.8 Reason string

Every decision produces one plain-English sentence. Examples:

- `"Beta selected: 40% cheaper than Gamma with comparable p95 latency."`
- `"Gamma selected: priority=speed, and Gamma's p95 is 3.1x faster than Alpha."`
- `"Beta selected: Alpha excluded (circuit open after 3 consecutive failures)."`

This string is generated, not templated by hand at every call site. Build one `explainDecision(decision): string` function.

---

## 10. API contracts

### 10.1 Router API

#### `POST /v1/route`

The single endpoint an agent needs.

**Request**
```json
{
  "capability": "text.summarize",
  "payload": { "text": "...", "maxWords": 60 },
  "constraints": {
    "maxPriceMicroUSDC": 20000,
    "priority": "balanced"
  },
  "agentId": "agent_demo_01"
}
```

**Response 200**
```json
{
  "requestId": "req_01H...",
  "result": { "summary": "..." },
  "routing": {
    "selectedProvider": "prov_beta",
    "selectedProviderName": "Beta Summarize",
    "reason": "Beta selected: 40% cheaper than Gamma with comparable p95 latency.",
    "candidatesEvaluated": 3,
    "fallbackChain": ["prov_beta"],
    "decisionId": "dec_01H..."
  },
  "payment": {
    "amountMicroUSDC": 12000,
    "network": "testnet",
    "txIds": ["ABC..."],
    "groupId": null,
    "feeSponsored": true,
    "finalityMs": 2840,
    "explorerUrl": "https://testnet.explorer.perawallet.app/tx/ABC..."
  },
  "timing": {
    "decisionMs": 3,
    "providerMs": 812,
    "settlementMs": 2840,
    "totalMs": 3655
  }
}
```

**Response 402** — no provider satisfies `maxPriceMicroUSDC`.
```json
{
  "error": "no_affordable_provider",
  "message": "Cheapest eligible provider costs 18000 µUSDC, ceiling is 12000.",
  "cheapestAvailableMicroUSDC": 18000
}
```

**Response 503** — all providers exhausted or circuit-broken.
```json
{
  "error": "no_provider_available",
  "message": "All 3 providers for text.summarize are circuit-open.",
  "attempted": ["prov_alpha", "prov_beta", "prov_gamma"]
}
```

#### `POST /v1/providers`
Self-registration. Body is a `Provider` minus observed fields. Returns the created provider.

#### `GET /v1/providers`
All providers with live health state. Powers the dashboard provider panel.

#### `GET /v1/decisions?limit=50`
Recent decisions, newest first, each with full `candidates[]`.

#### `GET /v1/stats`
Returns `SavingsSnapshot`.

#### `POST /v1/providers/:id/chaos`
**Demo control.** Forces a provider into a failure mode.
```json
{ "mode": "offline" | "slow" | "garbage" | "healthy" }
```
This is the only human-triggered endpoint in the system, and it simulates an external event (a provider going down), not a routing decision. Say this explicitly on stage.

#### `WS /v1/events`
Broadcasts on every state change:
```json
{ "type": "decision" | "payment" | "call" | "circuit" | "stats", "data": { } }
```

### 10.2 Provider API

Every mock provider exposes an identical contract.

#### `POST /<capability-path>`

**Without payment → 402**
```json
{
  "x402Version": 1,
  "accepts": [{
    "scheme": "exact",
    "network": "algorand-testnet",
    "maxAmountRequired": "12000",
    "asset": "<USDC ASA ID>",
    "payTo": "<algorand address>",
    "resource": "/summarize",
    "description": "Text summarization, per call",
    "mimeType": "application/json",
    "maxTimeoutSeconds": 30
  }]
}
```
`[VERIFY]` exact field names against the current Algorand x402 spec before implementing. Do not guess.

**With valid payment → 200** with the capability result.

#### `GET /health`
Returns `{ "status": "ok", "capability": "...", "priceMicroUSDC": N }`.

---

## 11. Payment layer

### 11.1 Standard flow

1. Router calls provider without payment.
2. Provider returns `402` with payment requirements.
3. Router validates the quoted price against `constraints.maxPriceMicroUSDC`. **If the quote exceeds the ceiling, abort and re-route — do not pay.** A provider that advertises one price and quotes another is a fraud signal; record it.
4. Router constructs the Algorand payment transaction (USDC ASA transfer to `payTo`).
5. Router builds the atomic group (see 11.2), signs, and attaches per the x402 payload spec.
6. Router retries the request with the payment header.
7. Provider verifies via the facilitator and returns the result.
8. Router records `PaymentRecord` with tx ids and measured finality.

### 11.2 Atomic transaction grouping — the Algorand differentiator

Algorand groups execute all-or-nothing with no partial state. Route402 uses this in two places:

**Fee abstraction (US9, P1).** The payment transaction is signed by the agent's wallet; a second transaction from the router's sponsor wallet covers the fees for both. The agent therefore needs USDC but zero ALGO. This is a genuine onboarding unlock: an agent can transact without ever holding the native token.

**Composite requests (US8, P1).** When one agent request requires two providers — e.g. `text.summarize` followed by `text.translate` — both payments go into a single atomic group. Either both providers are paid and both results return, or nothing settles and nothing is charged. On any other chain this requires an escrow contract and multi-block coordination. Here it is a primitive.

Say this on stage in exactly these terms: *"This is not Algorand because we had to pick a chain. It is Algorand because a two-provider request is one atomic group, and finality lands inside the HTTP request."*

### 11.3 Non-payment on non-delivery

The guard verifies delivery before settlement is treated as valid:

- HTTP status is 2xx
- Response body parses
- Response contains the expected capability output field and it is non-empty
- Response arrived within the provider's declared `maxTimeoutSeconds`

Fail any check → `PaymentRecord.status = 'refused'`, failure recorded against the provider, request re-routed. Surface refused payments prominently in the dashboard; "paid on delivery, not on request" is a line judges will remember.

### 11.4 Wallets

| Wallet | Purpose | Funding |
|---|---|---|
| Agent wallet | Pays for capabilities | TestNet USDC + no ALGO (proves fee abstraction) |
| Sponsor wallet | Pays network fees for grouped txns | TestNet ALGO |
| Provider wallets × 3 | Receive payment | Empty at start — balance growth is visible proof |

Keys in `.env`, never committed. TestNet only in the repo. MainNet keys stay local.

---

## 12. Dashboard specification

Single page, no routing, no nav. Designed to be readable from the back of a room on a projector. Dark background, high contrast, large numerals.

### 12.1 Layout (top to bottom)

**Row 1 — Headline metrics.** Four large numbers.
- Total requests routed
- Total spent (µUSDC, formatted)
- **Saved vs. naive routing** — largest element on the page, with percentage
- Average settlement time (ms)

**Row 2 — Provider health strip.** One card per provider:
- Name, capability, current price
- Circuit state as a colour + word (`closed` green / `half_open` amber / `open` red)
- p95 latency, success rate, total earned
- A sparkline of the last 20 calls

**Row 3 — Live decision feed.** Newest at top, animating in via WebSocket. Each row expands to show all candidates with their scores and, critically, the rejected ones with reasons. The reason string is always visible collapsed.

**Row 4 — Settlement ledger.** Recent payments with amount, provider, finality time, `refused` badge where applicable, and a clickable explorer link.

### 12.2 Demo controls

A small, visually separate panel — clearly marked "Simulation controls" so no judge mistakes it for part of the routing logic. Buttons: kill / slow / corrupt / restore, per provider. Plus a "send 20 requests" load button.

### 12.3 Non-requirements

No login. No dark-mode toggle. No mobile layout. No settings page.

---

## 13. Build phases

Two days. Phases are sequential. Do not start a phase before the previous one runs end to end.

### Day 1

**Phase 0 — Foundation (1h)**
- Monorepo scaffold: `/router`, `/providers`, `/dashboard`, `/agent`, `/shared`
- Shared TypeScript types from Section 8 in `/shared/types.ts`
- SQLite schema + migrations
- `concurrently` script that boots everything
- **Exit:** `npm run dev` starts all services; health checks pass.

**Phase 1 — Providers (1.5h)**
- One Express template, instantiated three times with different config
- Profiles: Alpha (cheap/slow), Beta (mid/mid), Gamma (expensive/fast)
- Chaos modes implemented from the start
- No x402 yet — plain HTTP with a fake price header
- **Exit:** all three respond, chaos modes work.

**Phase 2 — Registry + Scorer (2h)**
- Registry with in-memory state persisted to SQLite
- Scorer as a pure function, with a small test harness that prints a score table
- `explainDecision()` reason generation
- Circuit breaker: trip at 3 consecutive failures, half-open probe after 30s
- **Exit:** given three providers, the scorer picks correctly under all three priority profiles, and you can explain any decision it makes.

**Phase 3 — x402 integration (3h — the risk phase)**
- `[VERIFY]` package names, spec fields, facilitator endpoints against live docs **first**
- Provider side: return real 402, verify real payments
- Router side: handshake, build txn, sign, attach, retry
- TestNet only
- **Exit:** one real payment settles on TestNet and the explorer link resolves.

> **Risk note:** this is the phase most likely to overrun. If Phase 3 is not done by end of Day 1, freeze it, ship Phase 4–5 against the working payment path you have, and return to atomic grouping only if time allows. A working simple payment beats a broken sophisticated one.

**Phase 4 — Guard + fallback (1h)**
- Delivery verification, payment refusal, automatic re-route
- Fallback chain recording
- **Exit:** kill a provider mid-request; the request still succeeds via another and the dead provider is not paid.

### Day 2

**Phase 5 — Dashboard (3h)**
- WebSocket event stream from router
- All four rows from Section 12
- Savings calculation
- **Exit:** run 20 requests, watch everything update live.

**Phase 6 — Algorand differentiators (2h)**
- Fee abstraction: agent wallet holds zero ALGO and still transacts
- Composite request: one agent call, two providers, one atomic group
- Surface both in the dashboard with explicit labels
- **Exit:** both demonstrable on demand.

**Phase 7 — MainNet + polish (1.5h)**
- Deploy the router endpoint publicly, MainNet config, tiny real amounts
- `[VERIFY]` and complete GoPlausible facilitator registration
- README with architecture diagram
- **Exit:** a live MainNet transaction exists and is linkable.

**Phase 8 — Demo rehearsal (1.5h)**
- Run the Section 14 script end to end, timed, three times
- Seed the database with ~200 prior requests so the savings number is substantial on open
- Prepare offline fallback: recorded video + screenshots
- **Exit:** the demo runs clean three times consecutively.

---

## 14. Demo script

Target: 4 minutes. Every second shows the product working.

**0:00 — The hook (20s)**
Open on the dashboard, pre-seeded, numbers already large.
> "Every request on this screen was made by an agent that has no accounts, no API keys, and doesn't know which company served it. It just needed something done."

**0:20 — The problem (30s)**
> "AI agents need to buy things. Until x402, buying meant signup, API key, credit card, invoice. Fine for one provider. Impossible for twenty. So every agent is hardwired to one provider a human picked at build time — probably not the cheapest, probably not the fastest, and sometimes down."

**0:50 — One request, end to end (60s)**
Fire a single request. Walk the decision feed: three candidates, their scores, why one won. Click through to the explorer.
> "Three providers evaluated. Beta won on price at comparable latency. Payment constructed, settled on Algorand, finality in under three seconds — inside the HTTP request. That's a real transaction."

**1:50 — Kill a provider (60s)**
Fire continuous traffic. Kill Beta live.
> "Beta just went down. Watch."
Failures appear, breaker trips, traffic reroutes, requests keep succeeding.
> "No human touched that. And notice — Beta was never paid for the requests it failed. Payment on delivery, not on request."

**2:50 — The Algorand argument (45s)**
Trigger a composite request.
> "This one request needs two providers. Both payments are in a single atomic transaction group — both settle or neither does. And this agent wallet holds zero ALGO; the router sponsors the fee. That's not a workaround, that's a native Algorand primitive. On a chain with probabilistic finality this doesn't fit inside an HTTP request at all."

**3:35 — Close (25s)**
Point at the savings number.
> "Thirty-one percent cheaper than always calling the premium provider, zero downtime through two outages, no human in the loop. Our endpoint is live on MainNet. Agents can now pay for things themselves — Route402 decides who gets paid."

### Demo hygiene

- Pre-seed the DB. A savings counter reading ₹0.02 undermines everything.
- Hard-code nothing that could be discovered as hard-coded. Assume a judge asks to see the scorer.
- Have the explorer tab pre-opened.
- Record a full run as video before you present.

---

## 15. Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| x402 Algorand tooling is undocumented or in flux | High | Critical | `[VERIFY]` everything in Phase 3 before coding. Timebox to 3h. Fallback: implement the 402 handshake manually with raw `algosdk` — the spec is public. |
| Wrong USDC ASA ID / unfunded wallet | Medium | High | Verify balances at the start of Phase 3 and again before demo. Script a pre-flight check. |
| Venue wifi fails during live demo | Medium | Critical | Recorded video ready. Local-only mode that runs everything except settlement. |
| Savings number looks trivial | Medium | Medium | Pre-seed history. Show percentage prominently, not just absolute. |
| Scope creep into marketplace features | Medium | High | Section 2.4 is binding. |
| Solo dev fatigue on day 2 | High | Medium | Phases 5–8 are the demo. Protect them. Cut Phase 6 before cutting Phase 8. |

---

## 16. Out of scope

Forbidden for this build:

- User accounts, login, sessions, JWT
- Provider onboarding UI
- Any payment method other than x402/Algorand
- Multi-chain support
- Rate limiting, quotas, API keys for Route402 itself
- Kubernetes, Docker Compose, CI/CD
- Test coverage targets (write tests only for the scorer)
- Mobile layouts
- Real third-party AI provider integrations

---

## 17. Post-hackathon direction

Worth one slide, not one hour of build time.

- Real providers instead of simulated ones
- Provider reputation as a portable, on-chain artifact
- Price discovery: providers bid per request rather than posting fixed prices
- SDK: `route402.call(capability, payload)` as a drop-in replacement for direct API calls
- Router as a paid x402 service itself — Route402 charges a routing fee, making it composable into other agents

---

## 18. Acceptance criteria

Route402 is done when all of the following are true:

- [ ] An agent can call one endpoint and receive a result without knowing the provider
- [ ] Three providers with distinct price/latency profiles are registered and routable
- [ ] Every routed request produces a `RouteDecision` listing all candidates, including rejected ones with reasons
- [ ] Every successful request produces a real, explorer-verifiable Algorand settlement
- [ ] `maxPriceMicroUSDC` is never exceeded
- [ ] Killing a provider mid-traffic causes automatic reroute with no human intervention
- [ ] A failed provider is never paid, and the refusal is visible in the UI
- [ ] Fee abstraction demonstrated: agent wallet holds zero ALGO
- [ ] Composite request demonstrated: two providers, one atomic group
- [ ] Dashboard shows savings vs. naive routing, updating live
- [ ] Route402 endpoint is live on MainNet
- [ ] Demo runs clean three consecutive times
