# VERIFY — resolved facts about the x402 / Algorand tooling

Every `[VERIFY]` marker in [PRD.md](PRD.md) resolves here.

**Why this file exists:** the Algorand x402 tooling is fast-moving. Package names, spec field names, facilitator endpoints and asset IDs change, and a wrong guess in Phase 3 costs hours that the schedule does not have. Nothing in this file may be filled in from memory or inference — only from live documentation, with the URL and the date checked recorded alongside it.

**Rule:** if a row is `UNVERIFIED`, do not write code that depends on it.

Resolve this file at the **start of Phase 3** (first 45 minutes, before any implementation).

---

## Open questions

Pass 1 done 2026-07-31 via web search/fetch (docs pages + GitHub, not the actual npm package source). This is enough to unblock **credential collection**, not enough to unblock **Phase 3 coding** — anything still `UNVERIFIED` or `CONFLICTING` must be re-checked against the actual package source/types before it's used in code, per CLAUDE.md rule 3.

| # | Question | Answer | Source URL | Checked |
|---|---|---|---|---|
| 1 | Exact npm package name(s) + version for Algorand x402 support | `CONFLICTING` — GitHub docs README says scope is `@x402/*` (`@x402/core`, `@x402/avm`, `@x402/express`); a search-engine summary of the same doc tree said `@x402-avm/*` (`@x402-avm/express`, `@x402-avm/axios`...). Do not pick one from memory — run `npm search x402` and `npm view <name>` at the start of Phase 3 and take whatever the registry actually returns. | [GoPlausible/.github docs tree](https://github.com/GoPlausible/.github/blob/main/profile/algorand-x402-documentation/README.md) | 2026-07-31 |
| 2 | Is the canonical spec Coinbase x402, or a GoPlausible Algorand profile of it? | `RESOLVED` — GoPlausible built the AVM (Algorand Virtual Machine) extension to Coinbase's x402 spec, in collaboration with Algorand Foundation, and contributed it upstream to Coinbase's x402 repo. Treat it as an official network profile, not a fork. | [x402.goplausible.xyz](https://x402.goplausible.xyz/) | 2026-07-31 |
| 3 | Exact field names in the 402 response `accepts[]` object | `UNVERIFIED` — not confirmed against actual package types/source, only marketing docs. | | |
| 4 | Payment header name and payload encoding (base64? JSON?) | `UNVERIFIED` | | |
| 5 | Facilitator **verify** endpoint URL (TestNet) | `PARTIAL` — base URL is `https://facilitator.goplausible.xyz/`, same base serves both TestNet and MainNet (no separate subdomain). Exact path (e.g. `/verify`) not confirmed — the docs page at `/docs` didn't return path-level detail via fetch. | [facilitator.goplausible.xyz](https://facilitator.goplausible.xyz/) | 2026-07-31 |
| 6 | Facilitator **settle** endpoint URL (TestNet) | `PARTIAL` — same base URL as #5, exact path unconfirmed. | [facilitator.goplausible.xyz/docs](https://facilitator.goplausible.xyz/docs) | 2026-07-31 |
| 7 | Who submits the transaction — router or facilitator? | `UNVERIFIED` | | |
| 8 | USDC ASA ID on **TestNet** | `RESOLVED` — **10458941**. Cross-confirmed by two independent sources. | [GoPlausible docs](https://github.com/GoPlausible/.github/blob/main/profile/algorand-x402-documentation/README.md), [Bitquery TestNet explorer](https://explorer.bitquery.io/algorand_testnet/token/15200868) | 2026-07-31 |
| 9 | USDC ASA ID on **MainNet** | `RESOLVED` — **31566704**. | [GoPlausible docs](https://github.com/GoPlausible/.github/blob/main/profile/algorand-x402-documentation/README.md) | 2026-07-31 |
| 10 | `network` string value for TestNet (e.g. `algorand-testnet`?) | `UNVERIFIED` — PRD §10.2's `"algorand-testnet"` is illustrative only, not confirmed against real package types. | | |
| 11 | Does the spec support grouped/atomic payments natively, or is grouping router-side only? | `PARTIAL` — GoPlausible's docs describe "fee abstraction that allows the facilitator to pay transaction fees on behalf of the client through Algorand's atomic transaction groups and pooled fees" as a documented feature, so the primitive is native. Exact API shape (how the client constructs/signs the group) unconfirmed. | [x402.goplausible.xyz](https://x402.goplausible.xyz/) | 2026-07-31 |
| 12 | Fee-abstraction pattern: how is the sponsor txn expressed in the group? | `PARTIAL` — same finding as #11; needs the actual SDK/types to nail the shape. | | 2026-07-31 |
| 13 | TestNet ALGO dispenser URL | `RESOLVED` — **https://dispenser.testnet.aws.algodev.network/**. Sign in with Google, complete reCAPTCHA, paste address, dispense. This is the URL the *current* Algorand dev docs point to — older guides reference `testnet.algoexplorer.io/dispenser`, which is a legacy/third-party mirror; prefer the `aws.algodev.network` one. | [dev.algorand.co/concepts/accounts/funding](https://dev.algorand.co/concepts/accounts/funding/) | 2026-07-31 |
| 14 | Source of TestNet USDC | `PARTIAL` — a search-engine summary claims the official dispenser above also offers "5 ALGO **or** 100 USDC every 24 hours," but this wasn't confirmed by directly reading the dispenser page's UI. Fallback: Folks Finance has a TestNet USDC faucet built into its TestNet web app. Confirm which UI actually has the USDC option when you get there — don't assume. | [Folks Finance TestNet guide](https://v1.docs.folks.finance/helpful-guides/folks-finances-testnet) | 2026-07-31 |
| 15 | GoPlausible facilitator registration process for the public leaderboard (Phase 7) | `PARTIAL` — no separate signup step appears to exist. Coinbase's x402 Bazaar (the model GoPlausible's AVM extension mirrors) catalogs a resource automatically the first time a payment settles for it, provided the payment payload includes `resource`. If that holds for the Algorand facilitator too, "registration" = make one real settled payment with the field populated. Confirm this against the actual GoPlausible Bazaar extension docs before relying on it. | [Coinbase x402 Bazaar docs](https://docs.cdp.coinbase.com/x402/bazaar) | 2026-07-31 |
| 16 | Explorer URL template for a tx, per network | `UNVERIFIED` — current official Algorand explorer is **Lora** (`lora.algokit.io`), which replaced AlgoExplorer, but the exact tx URL pattern wasn't confirmed (page blocked automated fetch). Check by pasting a real TestNet tx id into `lora.algokit.io` once you have one. | | |

---

## Node access (not in the original 16, but needed by `.env.example`)

| Setting | Finding | Source | Checked |
|---|---|---|---|
| Algod / Indexer provider | `RESOLVED` (recommendation) — **Nodely** (formerly AlgoNode) offers free Algod + Indexer APIs for TestNet and MainNet with **no API token required**. Free tier adds ~50ms artificial latency per response — fine for a demo, not for a latency benchmark. | [nodely.io/docs/free/start](https://nodely.io/docs/free/start/), [endpoint matrix](https://nodely.io/docs/free/endpoints/) | 2026-07-31 |
| Algod TestNet URL | `RESOLVED` — `https://testnet-api.4160.nodely.dev` | [nodely.io/docs/free/start](https://nodely.io/docs/free/start/) | 2026-07-31 |
| Indexer TestNet URL | `UNVERIFIED` — likely a sibling domain on the same pattern; read the [endpoint matrix](https://nodely.io/docs/free/endpoints/) directly rather than guessing the subdomain. | | |
| Token value | `RESOLVED` — leave `ALGOD_TOKEN` / `INDEXER_TOKEN` **empty**; Nodely's free tier needs none. | | 2026-07-31 |

---

## Confirmed environment

```
ALGOD_URL_TESTNET   = https://testnet-api.4160.nodely.dev
ALGOD_TOKEN         = (empty — Nodely free tier requires none)
INDEXER_URL_TESTNET = (check https://nodely.io/docs/free/endpoints/ — not yet confirmed)
USDC_ASA_TESTNET    = 10458941
USDC_ASA_MAINNET    = 31566704
FACILITATOR_TESTNET = https://facilitator.goplausible.xyz/ (exact verify/settle paths unconfirmed)
EXPLORER_TX_TEMPLATE= https://lora.algokit.io/... (exact pattern unconfirmed — check with a real tx id)
```

---

## Deviations from the PRD

The PRD's example payloads (§10.2) were written before verification and are **illustrative, not authoritative**. Record every place the real spec differs, so the discrepancy is a documented decision rather than a silent drift.

| PRD says | Reality | Action taken |
|---|---|---|
| _(none recorded yet)_ | | |

---

## Fallback decision

If questions 1–7 cannot be resolved inside the 45-minute verification window, implement the 402 handshake directly against raw `algosdk`. The x402 spec is public and the payment is an ordinary USDC ASA transfer — the facilitator is a convenience, not a requirement.

Record the decision here if taken:

- [ ] Fell back to raw `algosdk`. Date: — Reason: —
