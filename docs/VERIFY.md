# VERIFY — resolved facts about the x402 / Algorand tooling

Every `[VERIFY]` marker in [PRD.md](PRD.md) resolves here.

**Why this file exists:** the Algorand x402 tooling is fast-moving. Package names, spec field names, facilitator endpoints and asset IDs change, and a wrong guess in Phase 3 costs hours that the schedule does not have. Nothing in this file may be filled in from memory or inference — only from live documentation, with the URL and the date checked recorded alongside it.

**Rule:** if a row is `UNVERIFIED`, do not write code that depends on it.

Resolve this file at the **start of Phase 3** (first 45 minutes, before any implementation).

---

## Open questions

Pass 1 (2026-07-31) was web search/fetch only — docs pages and GitHub, not actual package source. **Pass 2 (2026-07-31) resolves everything against the real npm packages**: downloaded and extracted the `.tgz` for `@x402/core@2.20.0`, `@x402/avm@2.20.0`, `@x402/express@2.20.0`, `@x402/extensions@2.20.0` via `npm pack`, and read the shipped `.d.mts` type declarations and compiled `.mjs` source directly — not memory, not a doc summary. All previously `UNVERIFIED`/`CONFLICTING`/`PARTIAL` rows below are now resolved from that source.

| # | Question | Answer | Source | Checked |
|---|---|---|---|---|
| 1 | Exact npm package name(s) + version for Algorand x402 support | `RESOLVED` — scope is **`@x402/*`**, not `@x402-avm/*`. Confirmed live on the npm registry: `@x402/core@2.20.0`, `@x402/avm@2.20.0` ("x402 Payment Protocol AVM (Algorand) Implementation"), `@x402/express@2.20.0`, `@x402/extensions@2.20.0`. All four published 3 days before this check by Coinbase's `x402-foundation` org via GitHub Actions/OIDC — actively maintained, not stale. | `npm view @x402/core`, `npm view @x402/avm`, npm registry search | 2026-07-31 |
| 2 | Is the canonical spec Coinbase x402, or a GoPlausible Algorand profile of it? | `RESOLVED` (unchanged from pass 1) — GoPlausible's AVM extension was contributed upstream into Coinbase's `x402-foundation/x402` repo; `@x402/avm` now ships from that same org/registry scope. | [x402.goplausible.xyz](https://x402.goplausible.xyz/) | 2026-07-31 |
| 3 | Exact field names in the 402 response `accepts[]` object | `RESOLVED`, corrected during implementation (2026-07-31 pm) — my first pass read `@x402/core`'s `PaymentRequirementsV1` type and reported `maxAmountRequired`/`resource`/`description`/`mimeType`/`outputSchema` per-entry, matching PRD §10.2's illustration. That's the **legacy V1 shape**; the SDK's default/current (non-suffixed) `PaymentRequirements` type — what `x402Client`/`x402HTTPClient` actually negotiate unless you explicitly pin `x402Version: 1` — is smaller and uses different names: `{ scheme, network, asset, amount, payTo, maxTimeoutSeconds, extra }`. `resource`/`description`/`mimeType` moved out of each `accepts[]` entry onto a single top-level `PaymentRequired.resource: ResourceInfo` object instead. `tsc` caught the mismatch (`Property 'maxAmountRequired' does not exist on type 'PaymentRequirements'`) when the router code was written against the V1 names — a live demonstration of exactly the risk this file exists to catch. PRD §10.2's example is illustrative-only for the current protocol version too, not just for network-string naming. | `@x402/core` dist `x402Client-*.d.mts`, confirmed via `tsc` type error | 2026-07-31 |
| 4 | Payment header name and payload encoding (base64? JSON?) | `RESOLVED` — request header is **`X-PAYMENT`** (compiled source also accepts legacy `payment-signature` on read), value is `encodePaymentSignatureHeader(paymentPayload)` — base64 of the JSON payload. Success response header is **`X-PAYMENT-RESPONSE`** (legacy alias `PAYMENT-RESPONSE`), decoded with `decodePaymentResponseHeader`. | `@x402/core` `chunk-4Y6I6537.mjs` (compiled source, not just types) | 2026-07-31 |
| 5 | Facilitator **verify** endpoint URL (TestNet) | `RESOLVED` — path is exactly `{facilitatorBaseUrl}/verify`, confirmed from `HTTPFacilitatorClient`'s compiled `fetch()` call. Moot for our build: per architecture decision below, Route402 hosts its own facilitator rather than calling GoPlausible's, so this path is now *our own* router route, not an external call. | `@x402/core` `chunk-4Y6I6537.mjs` | 2026-07-31 |
| 6 | Facilitator **settle** endpoint URL (TestNet) | `RESOLVED` — `{facilitatorBaseUrl}/settle`, same source as #5. Also self-hosted now; see architecture decision below. | `@x402/core` `chunk-4Y6I6537.mjs` | 2026-07-31 |
| 7 | Who submits the transaction — router or facilitator? | `RESOLVED` — **the facilitator submits**, never the client/router directly. `FacilitatorAvmSigner.sendTransactions()` / `.waitForConfirmation()` are facilitator-side methods; the client (`ExactAvmScheme` in `@x402/avm/exact/client`) only *builds and signs its own leg* of the atomic group via `createPaymentPayload()`, it never calls algod itself. | `@x402/avm` `exact/facilitator/index.d.mts`, `signer-*.d.mts` | 2026-07-31 |
| 8 | USDC ASA ID on **TestNet** | `RESOLVED` — **10458941**. Now also directly confirmed inside `@x402/avm`'s own shipped constants (`USDC_TESTNET_ASA_ID = "10458941"`), independent of pass-1's external sources. | `@x402/avm` `exact/client/index.d.mts` | 2026-07-31 |
| 9 | USDC ASA ID on **MainNet** | `RESOLVED` — **31566704**, likewise confirmed in-package (`USDC_MAINNET_ASA_ID`). | `@x402/avm` `exact/client/index.d.mts` | 2026-07-31 |
| 10 | `network` string value for TestNet (e.g. `algorand-testnet`?) | `RESOLVED` — PRD §10.2's `"algorand-testnet"` was illustrative and is **wrong**; real values are CAIP-2 identifiers: TestNet = `algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDe`, MainNet = `algorand:wGHE2Pwdvd7S12BL5FaOP20EGYesN73k`. Package exports these as `ALGORAND_TESTNET_CAIP2` / `ALGORAND_MAINNET_CAIP2` constants — use those, never hand-type the string. Recorded as a PRD deviation below. | `@x402/avm` `exact/client/index.d.mts` | 2026-07-31 |
| 11 | Does the spec support grouped/atomic payments natively, or is grouping router-side only? | `RESOLVED` — native, and SDK-provided. Payload type is `ExactAvmPayloadV2 { paymentGroup: string[]; paymentIndex: number }` — an array of base64 msgpack-encoded txns forming one atomic group; `paymentIndex` marks which entry is the actual ASA transfer. `ExactAvmScheme.createPaymentPayload()` (client) builds this via `algokit-utils`' `TransactionComposer`, handling suggested params, group ID, and fee pooling automatically. | `@x402/avm` `exact/client/index.d.mts` | 2026-07-31 |
| 12 | Fee-abstraction pattern: how is the sponsor txn expressed in the group? | `RESOLVED` — when `paymentRequirements.extra.feePayer` names an address, the client scheme adds an **unsigned** fee-payer transaction into `paymentGroup` alongside its own signed ASA transfer. On the facilitator side, `decodeTransactionGroup()` only accepts an unsigned entry if its sender is one of the facilitator's own controlled addresses (`FacilitatorAvmSigner.getAddresses()`) — it then signs and submits it. **Consequence:** the fee-payer must be an address the *facilitator* controls, not just any wallet Route402 holds a key for. This is why we host our own facilitator (architecture decision below) rather than pointing at GoPlausible's hosted one — otherwise "the router's sponsor wallet covers fees" (PRD §11.2) would actually be GoPlausible's wallet, not ours. | `@x402/avm` `exact/facilitator/index.d.mts` | 2026-07-31 |
| 13 | TestNet ALGO dispenser URL | `RESOLVED` (unchanged from pass 1) — **https://dispenser.testnet.aws.algodev.network/**. Sign in with Google, complete reCAPTCHA, paste address, dispense. Needs a human in a browser — cannot be scripted. | [dev.algorand.co/concepts/accounts/funding](https://dev.algorand.co/concepts/accounts/funding/) | 2026-07-31 |
| 14 | Source of TestNet USDC | `PARTIAL` — unchanged from pass 1, still needs a human to check the dispenser UI directly for a USDC option (claimed "5 ALGO or 100 USDC/24h" by a secondary source, not yet eyeballed). Fallback: Folks Finance TestNet faucet. | [Folks Finance TestNet guide](https://v1.docs.folks.finance/helpful-guides/folks-finances-testnet) | 2026-07-31 |
| 15 | GoPlausible facilitator registration process for the public leaderboard (Phase 7) | `DEFERRED` — moot for TestNet dev now that Route402 self-hosts its facilitator (see below). If Phase 7's MainNet stretch goal is attempted and the public leaderboard credit is wanted, that specific MainNet flow can point at GoPlausible's hosted facilitator instead (config is per-network, not global) — revisit then, not now. | — | 2026-07-31 |
| 16 | Explorer URL template for a tx, per network | `RESOLVED` — current official explorer is **Lora**: `https://lora.algokit.io/{network}/transaction/{txId}` where `{network}` is `testnet` or `mainnet`. Confirmed against a real example URL (`.../testnet/transaction/SVBRAI6FFZ...`). | [lora.algokit.io](https://lora.algokit.io/testnet) | 2026-07-31 |

---

## Architecture decision: self-hosted facilitator (not GoPlausible's hosted one)

Decided with the user 2026-07-31, driven by finding #12 above. `@x402/core` ships a full facilitator SDK (`x402Facilitator` — `register()`, `verify()`, `settle()`, `getSupported()`), and `@x402/avm` ships the Algorand-specific facilitator scheme (`ExactAvmScheme` from `exact/facilitator`, keyed by `toFacilitatorAvmSigner(SPONSOR_KEY)`). Route402 runs this **in-process inside the router**, exposed as three plain Fastify routes (`/facilitator/verify`, `/facilitator/settle`, `/facilitator/supported`) that the providers' `paymentMiddlewareFromConfig` call instead of `https://facilitator.goplausible.xyz`.

Why: makes PRD §11.2 ("a second transaction from the router's sponsor wallet covers fees") literally true — our own `SPONSOR_MNEMONIC` is the signer, so its balance visibly drains, provable on the dashboard per Phase 6. It also removes a live external dependency during the demo (PRD §15's "venue wifi fails" risk already covers our own network; no reason to add GoPlausible's uptime as a second point of failure). Cost is small: the SDK does the verification/signing/submission logic, we only wire three thin HTTP routes around it.

Trade-off accepted: we lose GoPlausible's automatic Bazaar/leaderboard listing (#15) for TestNet. Not a blocker — Phase 7 (MainNet) is already an optional stretch goal, and if attempted, the MainNet facilitator client can point at GoPlausible specifically to get that listing, independent of how TestNet dev works.

---

## Node access (not in the original 16, but needed by `.env.example`)

| Setting | Finding | Source | Checked |
|---|---|---|---|
| Algod / Indexer provider | `RESOLVED` (recommendation) — **Nodely** (formerly AlgoNode) offers free Algod + Indexer APIs for TestNet and MainNet with **no API token required**. Free tier adds ~50ms artificial latency per response — fine for a demo, not for a latency benchmark. | [nodely.io/docs/free/start](https://nodely.io/docs/free/start/), [endpoint matrix](https://nodely.io/docs/free/endpoints/) | 2026-07-31 |
| Algod TestNet URL | `RESOLVED` — `https://testnet-api.4160.nodely.dev` | [nodely.io/docs/free/start](https://nodely.io/docs/free/start/) | 2026-07-31 |
| Indexer TestNet URL | `RESOLVED` — `https://testnet-idx.4160.nodely.dev` (sibling domain, `-idx` in place of `-api`). Legacy equivalents also confirmed live: `testnet-api.algonode.cloud` / `testnet-idx.algonode.cloud`. | [nodely.io/docs/free/endpoints](https://nodely.io/docs/free/endpoints/) | 2026-07-31 |
| Token value | `RESOLVED` — leave `ALGOD_TOKEN` / `INDEXER_TOKEN` **empty**; Nodely's free tier needs none. | | 2026-07-31 |
| `@algorandfoundation/algokit-utils` version | `RESOLVED` — `@x402/avm@2.20.0` pins `10.0.0-alpha.46` exactly; confirmed that version exists on the npm registry. Use the same version directly rather than letting two copies resolve. | `npm view @algorandfoundation/algokit-utils@10.0.0-alpha.46` | 2026-07-31 |
| `algosdk` (for account/mnemonic generation only — algokit-utils wraps it internally for everything else) | `RESOLVED` — latest is `3.6.0`, actively published. | `npm view algosdk` | 2026-07-31 |

---

## Confirmed environment

```
ALGOD_URL_TESTNET     = https://testnet-api.4160.nodely.dev
ALGOD_TOKEN           = (empty — Nodely free tier requires none)
INDEXER_URL_TESTNET   = https://testnet-idx.4160.nodely.dev
INDEXER_TOKEN         = (empty)
USDC_ASA_TESTNET      = 10458941
USDC_ASA_MAINNET      = 31566704
NETWORK_CAIP2_TESTNET = algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDe
NETWORK_CAIP2_MAINNET = algorand:wGHE2Pwdvd7S12BL5FaOP20EGYesN73k
FACILITATOR           = self-hosted at router :4000/facilitator/{verify,settle,supported} — no external URL
EXPLORER_TX_TEMPLATE  = https://lora.algokit.io/{network}/transaction/{txId}   (network = testnet | mainnet)
```

---

## Deviations from the PRD

The PRD's example payloads (§10.2) were written before verification and are **illustrative, not authoritative**. Record every place the real spec differs, so the discrepancy is a documented decision rather than a silent drift.

| PRD says | Reality | Action taken |
|---|---|---|
| §10.2 `"network": "algorand-testnet"` | Real value is the CAIP-2 identifier `algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDe` (TestNet) / `algorand:wGHE2Pwdvd7S12BL5FaOP20EGYesN73k` (MainNet). | Use `@x402/avm`'s exported `ALGORAND_TESTNET_CAIP2` / `ALGORAND_MAINNET_CAIP2` constants everywhere instead of hand-typing a string. |
| §11.2 "a second transaction from the router's sponsor wallet covers the fees" | Only literally true if Route402 controls the facilitator, since the protocol requires the unsigned fee-payer txn's sender to be an address the *facilitator* controls. | Route402 self-hosts its facilitator (see architecture decision above) instead of using GoPlausible's hosted one, so this line stays true. |
| §10.2 `accepts[]` example | Shows the legacy V1 field set (`maxAmountRequired`, per-entry `resource`/`description`/`mimeType`/`outputSchema`). The SDK's default (current, non-V1) protocol version uses `{scheme, network, asset, amount, payTo, maxTimeoutSeconds, extra}` per entry, with `resource` promoted to a single top-level `PaymentRequired.resource` object shared across all accepts. | Router code reads `requirement.amount`, not `.maxAmountRequired`. Provider route config passes `resource`/`description`/`mimeType` at the `RouteConfig` level (server-side input), not per-accept — the SDK builds the wire shape from that. |
| §18 "agent wallet holds zero ALGO" | Algorand requires ~0.1 ALGO minimum balance per account plus ~0.1 ALGO per opted-in asset (rent, not a fee) — an account holding USDC literally cannot be exactly 0 ALGO. What the fee-abstraction mechanic actually delivers is **zero ALGO spent on transaction fees**, not zero ALGO balance ever. | Fund the agent wallet with a small one-time rent amount (~0.2 ALGO) at setup, never top it up again, and word the dashboard/pitch as "zero ALGO spent on fees" rather than "zero ALGO balance." Revisit exact wording in Phase 6. |

---

## Fallback decision

If questions 1–7 cannot be resolved inside the 45-minute verification window, implement the 402 handshake directly against raw `algosdk`. The x402 spec is public and the payment is an ordinary USDC ASA transfer — the facilitator is a convenience, not a requirement.

Record the decision here if taken:

- [x] **Not needed.** Questions 1–7 resolved cleanly against real, actively-maintained `@x402/*` packages (pass 2, 2026-07-31) — no fallback to hand-rolled `algosdk` required. `algosdk` is still used directly, but only for account/mnemonic generation, not for building the x402 payment itself.
