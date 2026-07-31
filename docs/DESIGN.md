# Route402 — Design

| Field | Value |
|---|---|
| Scope | The dashboard (`/dashboard`) — every pixel a judge sees |
| Built in | Phase 5. Nothing here is built before Phase 5. |
| Authority | Binding for UI. Supersedes PRD §12 layout; **does not touch** PRD §8 (data models) or §10 (API contracts). |
| Reference | Supabase — dark, hairline borders, one green, boring nouns |
| Status | v1 — written 2026-07-31, pre-build |

---

## 0. Relationship to the PRD

PRD §12 specified a single scrolling page with no nav. This document revises that into
**one primary page plus two depth pages**, for one reason: a judge asks follow-up questions,
and "let me scroll past four sections to find the payment you asked about" is a worse answer
than "Payments, second tab."

What is preserved, unchanged:

- All four content blocks from PRD §12.1 still live on the primary page. Nothing demo-critical
  moved to a tab.
- Dark background, high contrast, large numerals, readable from the back of a room.
- Rejected candidates reach the screen (PRD §9.5, CLAUDE.md rule 6).
- Refused payments are prominent (PRD §11.3).
- Simulation controls are visually separated and explicitly labelled (PRD §12.2).

**The hard rule this buys back:** *the demo never leaves Overview.* Tabs exist for questions,
not for the script. If the PRD §14 demo requires a nav click, the design has failed.

What stays out of scope (PRD §2.4, §16): no login, no theme toggle, no mobile layout, no
settings page, no provider onboarding UI.

---

## 1. The thesis

> People hear "blockchain" and brace for complexity. The screen has to disagree before they
> finish the thought.

Route402 does something genuinely intricate — scores a provider pool, negotiates an HTTP 402,
builds an Algorand transaction group, verifies delivery, withholds payment on failure. The
interface's entire job is to make that look **obvious**.

Two design bets carry the whole product:

1. **Plain words.** Nothing on screen is named after its implementation. `circuitState: 'open'`
   is a state machine; on screen it is **Paused**. This is not dumbing down — it is refusing to
   make the viewer translate.
2. **Think out loud.** The system narrates what it is doing, in the present tense, one short
   sentence per step, while it does it. A viewer who reads nothing else still understands the
   product from five sentences.

Everything below is downstream of those two.

---

## 2. Principles

**P1 — Plain words, always.** If a term needs a glossary, it does not go on the main pages.
There is exactly one page where jargon is allowed, and it is called *How it works*.

**P2 — Narrate, don't log.** A log is a record for the person who wrote it. A narration is a
sentence for the person watching. Route402 narrates.

**P3 — Show the ones that lost.** A feed that shows only the winner shows nothing. Every
decision displays every option it considered, including the ones it refused, with why.

**P4 — One number that matters.** Each page has exactly one hero figure. On Overview it is
**Saved**. Everything else is support.

**P5 — Calm surfaces, loud data.** Borders not shadows, one accent, no gradients, no glass.
The only thing allowed to be colourful is a number or a status.

**P6 — Never fake it.** No animated progress that isn't real progress, no invented steps, no
rounded-up savings, no placeholder that could be mistaken for data. A demo that lies once is
worth nothing — and a judge who catches it has caught the whole project.

---

## 3. Think out loud — the narration system

This is the centrepiece. Build it first in Phase 5; the rest of the page is chrome around it.

### 3.1 The five steps

Every request the router handles is narrated as at most five steps. Five, always the same
five, always in this order, one verb each:

| # | Step | What fires it | Example sentence |
|---|---|---|---|
| 1 | **Ask** | request received | `An agent needs a summary. Budget: 0.020 USDC.` |
| 2 | **Compare** | `decision` event | `Checking 3 providers that can do this.` |
| 3 | **Pick** | `decision` event | `Beta wins — 0.012 USDC, 40% cheaper than Gamma at similar speed.` |
| 4 | **Pay** | `payment` event | `Paying Beta on Algorand.` → `Settled in 2.8s.` |
| 5 | **Deliver** | `call` verified | `Result checked and sent back to the agent.` |

The viewer learns the entire product model — ask, compare, pick, pay, deliver — without being
taught it. These five words are also the section spine of *How it works*, so the vocabulary is
used exactly once and reused everywhere.

### 3.2 Anatomy

```
┌─ Right now ─────────────────────────────────────── req_01H8X…  ─┐
│                                                                  │
│  ●  Ask       An agent needs a summary. Budget: 0.020 USDC.      │
│  │                                                          2ms  │
│  ●  Compare   Checking 3 providers that can do this.             │
│  │                                                          3ms  │
│  ●  Pick      Beta wins — 0.012 USDC, 40% cheaper than           │
│  │            Gamma at similar speed.                            │
│  │                                                         812ms │
│  ◐  Pay       Paying Beta on Algorand.                           │
│  │                                                               │
│  ○  Deliver                                                      │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

- **Dot states:** `○` pending (faint, hollow) · `◐` in flight (accent, pulsing) · `●` done
  (accent, solid) · `●` failed (red, solid).
- A 1px connector runs between dots — faint below the current step, accent above it. This is
  the only ornament in the app and it earns its place: it makes the sequence read as a
  sequence.
- Elapsed time sits right-aligned on the connector, in mono, muted. Real numbers only.
- The request id sits in the panel header, mono, muted, small. It is the only id on Overview.

### 3.3 Writing rules

1. **One sentence per step. Twelve words or fewer.** If it doesn't fit, the step is doing too
   much.
2. **Present tense while in flight. The sentence never changes after it is written.** Completion
   is shown by the dot and the elapsed time, not by rewriting text under the reader's eye.
3. **Sentence case. A full stop. No exclamation marks. No ellipsis except on an in-flight verb**
   (`Paying Beta on Algorand.` is fine; the pulsing dot already says "still going").
4. **Numbers carry units.** `0.012 USDC`, not `12000`. `812ms` under a second, `2.8s` above it.
5. **Never name an internal.** Banned in narration: score, composite, circuit, breaker, 402,
   facilitator, ASA, µUSDC, payload, endpoint, WebSocket, p95.
6. **Allowed and encouraged:** Algorand, USDC, TestNet, MainNet, wallet, transaction. These are
   facts about what happened, not implementation trivia, and the audience is a blockchain club.
7. **A step that did not happen is not shown.** No "Verifying…" if nothing verified.

### 3.4 Honesty under speed

A decision takes ~3ms. Rendered literally, steps 2 and 3 flash past unread.

**The rule:** each step holds on screen for a minimum of **350ms** before the next one appears,
but **the elapsed time displayed is always the real measured value**. A 3ms decision reads
`3ms` and holds for 350ms. The pacing is a reading aid; the number is the truth. This
distinction is the difference between a demo aid and a lie, and it gets stated on stage if
anyone asks.

Under load (the "send 20 requests" button) the panel shows the newest request only and drops
the minimum dwell to 120ms. The feed below carries the rest.

### 3.5 Failure narration

Failures get the same five steps, plus their own sentences. These are the most valuable
sentences in the product — they are what "no payment without delivery" looks like.

| Situation | Sentence | Dot |
|---|---|---|
| Guard rejects the response | `Beta returned an empty result. Not paying.` | red |
| Re-route | `Trying Alpha instead.` | new Pick step |
| Circuit trips | `Beta failed 3 times in a row. Pausing it.` | red |
| Half-open probe | `Checking whether Beta is back.` | amber |
| Recovery | `Beta is working again. Unpaused.` | accent |
| 402 no affordable provider | `Nothing available under 0.012 USDC. Turning this request down.` | amber |
| 503 all providers down | `All 3 providers are paused. Nothing to route to.` | red |
| Quote exceeds advertised | `Beta quoted more than it advertised. Not paying it.` | red |

### 3.6 Where narration lives

Two placements, **one component**:

- **Overview → "Right now" panel.** Always visible, directly under the metrics. Idle state:
  `Waiting for a request.` in muted ink, dots all hollow.
- **Any decision row, expanded.** Replays that request's five steps from stored records. Same
  component, `live={false}`, no pulsing, no dwell pacing.

### 3.7 Single source of sentences

`dashboard/src/lib/narrate.ts` exports `narrate(event) → Step[]`. **Every** sentence in the app
comes from there. No component writes narrative text inline.

This mirrors CLAUDE.md's rule for `explainDecision()` — one place turns state into English on
the router side, one place does it on the UI side. If a sentence is wrong, there is exactly one
file to open.

---

## 4. Language

### 4.1 The translation table

Left column is the code (PRD §8 — binding, never renamed). Right column is the only thing a
viewer ever sees. `dashboard/src/lib/labels.ts` owns this mapping; no component hardcodes a
right-hand value.

| Code | On screen |
|---|---|
| `capability: "text.summarize"` | Summarize text |
| `capability: "text.translate"` | Translate text |
| `candidates[]` | Options |
| `eligible: false` | Not considered |
| `ineligibleReason: "circuit open"` | Paused right now |
| `ineligibleReason: "exceeds max price"` | Over budget |
| `ineligibleReason: "excluded"` | Excluded by the request |
| `ineligibleReason: "capability not offered"` | Doesn't do this job |
| `compositeScore` | Score |
| `reliabilityScore: 0.98` | 98% delivered |
| `latencyP50Ms` | Typical speed |
| `latencyP95Ms` | Slow-day speed |
| `consecutiveFailures: 3` | 3 failures in a row |
| `circuitState: 'closed'` | **Live** |
| `circuitState: 'half_open'` | **Testing** |
| `circuitState: 'open'` | **Paused** |
| `status: 'pending'` | Paying |
| `status: 'settled'` | **Paid** |
| `status: 'failed'` | Payment failed |
| `status: 'refused'` | **Not paid** |
| `finalityMs: 2840` | Settled in 2.8s |
| `feeSponsored: true` | Fee covered by Route402 |
| `groupId != null` | Paid together |
| `txIds[]` / `explorerUrl` | Receipt |
| `fallbackChain` | Tried in order |
| `naiveBaselineMicroUSDC` | If we always used the priciest |
| `savedMicroUSDC` + `savedPercent` | **Saved** |
| `requestsRerouted` | Routed around a failure |
| `paymentsRefused` | Payments withheld |
| `maxPriceMicroUSDC` | Budget |
| `priority: 'cost' \| 'speed' \| 'balanced'` | Cheapest / Fastest / Balanced |
| `agentId` | Agent |
| any `…MicroUSDC` | `0.012 USDC` — via `formatMicroUSDC()`, always |

### 4.2 Banned on Overview, Providers and Payments

circuit breaker · composite score · normalisation · micro-USDC · µUSDC · 402 · x402 ·
facilitator · ASA · handshake · payload · endpoint · WebSocket · p50 · p95 · latency ·
eligible · candidate

Each has a plain replacement above. They are all permitted on *How it works*, once, next to
their plain-English twin.

### 4.3 Not banned

**Algorand. USDC. TestNet. MainNet. Wallet. Transaction. Atomic group. Receipt.**

The audience is the Algorand Blockchain Club. Hiding the chain would be cowardice and would
cost points. The rule is: hide the *plumbing*, show the *proof*.

### 4.4 Voice

- Sentence case everywhere. `ALL CAPS` only for 12px micro-labels with letter-spacing.
- Second person is not used. The system narrates itself, it does not address the viewer.
- No marketing adjectives on functional screens. `Saved`, not `Massive savings`.
- Never apologise in an error state. `Router unreachable. Retrying.` — not `Oops!`

### 4.5 Making the score legible without lying

`compositeScore` is lower-is-better, which is unintuitive. Three fixes, no transform:

1. Candidates are **sorted ascending**, so the winner is the top row. Position teaches the rule.
2. The winner's row carries a `Best` chip in accent.
3. One caption sits under every candidate table:
   > *Lower score wins. It blends price, speed and how often the provider delivers — weighted
   > by what the request asked for.*
4. The active weights are shown as a chip: `Balanced · price 35% · speed 35% · delivered 30%`.

Never rescale, invert, or convert the score to a percentage. A judge may ask to read
`scorer.ts` on stage and the number on screen must be the number in the code.

---

## 5. Information architecture

```
Route402                Overview   Providers   Payments   How it works        ● TestNet
```

Top bar, 56px, sticky, hairline bottom border. Brand left, four text links, network pill and
connection dot right. No icons in the nav — text is unambiguous and reads from the back of a
room. No dropdowns, no user menu, no search.

| Page | Path | Purpose | In the demo? |
|---|---|---|---|
| **Overview** | `/` | The projector page. Everything PRD §12 requires. | Yes — the whole script |
| **Providers** | `/providers` | The pool in full detail + simulation controls | Only if asked |
| **Payments** | `/payments` | Full settlement ledger, filterable | Only if asked |
| **How it works** | `/how` | One screen. Five steps + glossary. | No — cut first if time is short |

Page names are nouns a non-technical person would pick. No "Telemetry", no "Observability",
no "Console".

---

## 6. Visual system

### 6.1 Colour

Dark only. One theme, no toggle (PRD §2.4). Tokens are shared with `docs/index.html`, so the
project page and the app are visibly one thing.

**Surfaces & ink**

| Token | Hex | Use |
|---|---|---|
| `--bg` | `#0A0B0D` | page |
| `--surface` | `#121418` | cards, panels |
| `--surface-2` | `#171A1F` | expanded rows, hover, table headers |
| `--line` | `#22262D` | hairline borders, gridlines |
| `--line-2` | `#2C313A` | dividers inside a card |
| `--ink` | `#ECEEF2` | primary text, numbers |
| `--ink-2` | `#B6BCC7` | secondary text |
| `--muted` | `#7D8492` | labels, meta, axis text |
| `--faint` | `#565C68` | not-considered rows, pending dots |

**Accent — exactly one**

| Token | Hex | Use |
|---|---|---|
| `--accent` | `#3ECF8E` | selected, live, paid, links, the hero number |
| `--accent-soft` | `rgba(62,207,142,.12)` | winner-row wash, chip fill |
| `--accent-line` | `rgba(62,207,142,.28)` | winner-row border, focus ring |
| `--accent-ink` | `#0A0B0D` | text on an accent fill |

**Status — dot + word, never colour alone**

| Token | Hex | Means |
|---|---|---|
| `--ok` | `#3ECF8E` | Live · Paid · delivered |
| `--warn` | `#F5C451` | Testing · slow · turned down |
| `--bad` | `#F0736A` | Paused · failed · **Not paid** |
| `--info` | `#8AB4F8` | Fee covered · Paid together |

All four clear 3:1 on both `--bg` and `--surface` (validated). Under protanopia `--ok` and
`--warn` sit at ΔE 7.4 — below the 8 threshold — which is exactly why **every status renders
as a coloured dot *and* its word**, in every placement, with no exceptions. That pairing is the
mitigation, not a nicety.

**Chart series — validated, do not substitute**

| Token | Hex | Use |
|---|---|---|
| `--series-1` | `#1FA875` | actual spend |
| `--series-2` | `#D95926` | naive baseline |
| `--spark` | `#7D8492` | sparkline line (de-emphasised) |

Validated against surface `#121418`: lightness band PASS, chroma PASS, CVD separation deutan
ΔE 8.9 / tritan 33.0 PASS, normal-vision ΔE 27.1 PASS, contrast PASS. These are darker than
`--accent` on purpose: a data mark and a UI accent need different lightness on a dark surface.
**Do not use `--accent` as a chart fill.**

**Rules**

- Colour never decorates. If a colour is not carrying state, selection, or series identity, it
  is wrong.
- Never colour text with a series colour. Marks carry the hue; labels stay in ink tokens.
- No gradients, no glows, no glass, no backdrop blur except the sticky nav.

### 6.2 Type

No webfonts. The venue wifi is a listed risk (PRD §15) and a FOUT on the projector is
unforgivable. System stack only.

```
--font-sans: Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
--font-mono: ui-monospace, "Cascadia Code", "SF Mono", Menlo, Consolas, monospace;
```

| Role | Size / line | Weight | Tracking | Use |
|---|---|---|---|---|
| `display` | 56 / 1.0 | 600 | −0.03em | the hero number. **One per page.** |
| `h1` | 28 / 1.2 | 600 | −0.02em | page title |
| `h2` | 18 / 1.3 | 600 | −0.01em | panel title |
| `body` | 16 / 1.5 | 400 | — | default, narration sentences |
| `small` | 14 / 1.45 | 400 | — | table cells, secondary |
| `label` | 12 / 1.2 | 500 | 0.06em, uppercase | micro-labels only |
| `mono` | 13 / 1.4 | 400 | — | ids, hashes, addresses, scores, prices in tables |

- **Money, scores, and ids are always mono.** They are looked at, not read.
- `font-variant-numeric: tabular-nums` in **columns only** (tables, axis ticks). The hero
  number uses proportional figures — tabular makes a 56px `31%` look gappy.
- Nothing below 13px carries meaning.

### 6.3 Space, shape, elevation

- 4px base scale: `4 · 8 · 12 · 16 · 24 · 32 · 48`. Nothing off-scale.
- Page: `max-width 1400px`, gutter 32px, vertical rhythm 24px between panels.
- Card padding 20px. Table row height 44px. Nav 56px.
- Radius: `8px` cards · `6px` controls · `4px` chips · `999px` dots and pills.
- **No shadows anywhere.** Depth is one surface step plus a hairline border. This is the single
  biggest lever on "does it feel simple", and it is free.

### 6.4 Motion

| Token | Value |
|---|---|
| duration-fast | 120ms — hover, press |
| duration-base | 180ms — enter, fade |
| duration-slow | 240ms — row expand |
| easing | `cubic-bezier(.2, 0, 0, 1)` |

- Enter: `opacity 0→1` + `translateY(4px→0)`. Nothing slides in from a side.
- New feed rows fade in at the top; the list below moves down. No push-flash, no highlight
  sweep.
- **One looping animation exists in the entire app:** the in-flight step dot, 1.6s, opacity
  0.45↔1. Everything else is a one-shot transition.
- **No animated counters** — except the hero `Saved` figure, which counts to its new value over
  240ms. One exception, deliberate, because it is the number the close of the demo points at.
- No skeleton shimmer. Unknown values render as `—` in `--muted`.
- `@media (prefers-reduced-motion: reduce)` drops all translate and the pulse; opacity
  transitions stay.

### 6.5 Icons

~10 hand-rolled inline SVGs, 16px, `stroke-width 1.6`, round caps, no fill — matching
`docs/index.html`. No icon library dependency. Icons never appear alone; every icon has a text
label beside it.

---

## 7. Component inventory

Thirteen components. If a screen needs a fourteenth, question the screen first.

| Component | Anatomy |
|---|---|
| `StatusDot` | 8px dot + word. **Never one without the other.** Props: `state`, `label`. |
| `Chip` | 4px radius, 12px text, 2px/8px padding. Variants: neutral, accent, warn, bad, info. |
| `StatTile` | label (12px muted) · value (mono or display) · optional sub-line · optional sparkline. |
| `HeroStat` | The `Saved` tile. 56px value, `savedPercent` beneath in accent, baseline comparison in muted. |
| `NarrationPanel` | §3.2. Props: `steps`, `live`. Used on Overview and inside expanded rows. |
| `ProviderCard` | name · job · price · `StatusDot` · typical/slow speed · delivered % · earned · sparkline. |
| `DecisionRow` | Collapsed: time · job · winner · reason (always visible) · price · chevron. Expanded: `CandidateTable` + `NarrationPanel`. |
| `CandidateTable` | Options table (§8.1). Winner row washed accent. Not-considered rows in `--faint` with their reason. |
| `PaymentRow` | time · provider · amount · status chip · settled-in · badges · receipt link. |
| `Sparkline` | 20 points, 2px line in `--spark`, last point 8px accent dot, failures as `--bad` dots with a 2px surface ring. |
| `EmptyState` | One muted sentence. No illustration, no icon, no button. |
| `ConnectionPill` | Network name + dot. Green connected, amber `Reconnecting…`, red `Router unreachable`. |
| `SimPanel` | Dashed 1px `--line-2` border, `--bg` fill, header `Simulation — not part of routing`. §8.5. |

---

## 8. Screens

### 8.1 Overview — `/`

The projector page. Everything the demo needs, in scroll order, top block visible without
scrolling at 1920×1080.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Route402      Overview  Providers  Payments  How it works        ● TestNet   │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────┐  ┌────────────┐ ┌────────────┐ ┌────────────┐  │
│  │ SAVED                    │  │ REQUESTS   │ │ SPENT      │ │ SETTLES IN │  │
│  │                          │  │            │ │            │ │            │  │
│  │  0.412 USDC              │  │    218     │ │ 2.284 USDC │ │   2.7s     │  │
│  │  31% cheaper             │  │            │ │            │ │  average   │  │
│  │  vs. always using the    │  │ 4 routed   │ │ 3 payments │ │            │  │
│  │  priciest provider       │  │ around a   │ │ withheld   │ │            │  │
│  │                          │  │ failure    │ │            │ │            │  │
│  └──────────────────────────┘  └────────────┘ └────────────┘ └────────────┘  │
│                                                                              │
│  ┌─ Right now ──────────────────────────────────────────  req_01H8X… ─────┐  │
│  │  ●  Ask       An agent needs a summary. Budget: 0.020 USDC.       2ms  │  │
│  │  ●  Compare   Checking 3 providers that can do this.              3ms  │  │
│  │  ●  Pick      Beta wins — 0.012 USDC, 40% cheaper than Gamma      812ms │  │
│  │               at similar speed.                                        │  │
│  │  ◐  Pay       Paying Beta on Algorand.                                 │  │
│  │  ○  Deliver                                                            │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  Providers                                                                   │
│  ┌───────────────────┐ ┌───────────────────┐ ┌───────────────────┐           │
│  │ Alpha Summarize   │ │ Beta Summarize    │ │ Gamma Summarize   │           │
│  │ ● Live            │ │ ● Live            │ │ ● Paused          │           │
│  │ 0.008 USDC/call   │ │ 0.012 USDC/call   │ │ 0.022 USDC/call   │           │
│  │ 1.4s typical      │ │ 700ms typical     │ │ 250ms typical     │           │
│  │ 97% delivered     │ │ 99% delivered     │ │ 62% delivered     │           │
│  │ earned 0.512 USDC │ │ earned 1.44 USDC  │ │ earned 0.33 USDC  │           │
│  │ ╌╌╱╲╌╱╲╌╌╱╲╌╌╌╌●  │ │ ╌╌╌╌╌╌╌╌╌╌╌╌╌╌●  │ │ ╌╌╱╲╌●●●╌╌╌╌╌╌●  │           │
│  └───────────────────┘ └───────────────────┘ └───────────────────┘           │
│                                                                              │
│  Recent requests                                                             │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ 14:02:11  Summarize text   → Beta      Beta wins — 40% cheaper…   ⌄    │  │
│  │ 14:02:09  Summarize text   → Alpha     Gamma paused, Alpha…       ⌄    │  │
│  │ 14:02:07  Summarize text   → Beta      Beta wins — 40% cheaper…   ⌄    │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  Recent payments                                            See all →        │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ 14:02:11  Beta   0.012 USDC  ● Paid      2.8s  Fee covered  Receipt ↗  │  │
│  │ 14:02:09  Gamma  0.022 USDC  ● Not paid   —    didn't deliver          │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌╌ Simulation — not part of routing ╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┐  │
│  │  Alpha  [Kill] [Slow] [Corrupt] [Restore]      [Send 20 requests]      │  │
│  │  Beta   [Kill] [Slow] [Corrupt] [Restore]                              │  │
│  │  Gamma  [Kill] [Slow] [Corrupt] [Restore]                              │  │
│  └╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┘  │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Metric row.** `Saved` spans two columns and is the only `display`-size number on the page.
Its sub-line names the comparison in words — `vs. always using the priciest provider` — because
"naive baseline" means nothing to anyone. Optional secondary line: `≈ ₹34` with a documented
fixed rate constant and the word *approx.* (PRD §3 asks for rupees; if the rate can't be
sourced honestly, drop the line rather than invent it).

The other three tiles carry a sub-line that is itself a claim: `4 routed around a failure`,
`3 payments withheld`. These are the differentiators, sitting in plain sight without a callout.

**Expanded decision row:**

```
│ 14:02:11  Summarize text   → Beta     Beta wins — 40% cheaper…    ⌃    │
│ ┌────────────────────────────────────────────────────────────────────┐ │
│ │  Balanced · price 35% · speed 35% · delivered 30%                  │ │
│ │                                                                    │ │
│ │  Option        Price        Speed     Delivered   Score            │ │
│ │  Beta   Best   0.012 USDC   700ms     99%         0.284            │ │  ← accent wash
│ │  Alpha         0.008 USDC   1.4s      97%         0.351            │ │
│ │  Gamma         0.022 USDC   250ms     62%         Not considered   │ │  ← faint
│ │                                       Paused right now             │ │
│ │                                                                    │ │
│ │  Lower score wins. It blends price, speed and how often the        │ │
│ │  provider delivers — weighted by what the request asked for.       │ │
│ │                                                                    │ │
│ │  Tried in order:  Beta                                             │ │
│ │  [ the five-step narration for this request ]                      │ │
│ └────────────────────────────────────────────────────────────────────┘ │
```

The reason string from `explainDecision()` is **always visible collapsed** — that sentence is
the product. Expansion adds evidence, never the point.

Rejected options keep their row, in `--faint`, with the reason directly beneath in `--bad` or
`--warn`. They are never removed, greyed to illegibility, or collapsed behind a "show all"
toggle (CLAUDE.md rule 6).

### 8.2 Providers — `/providers`

One card per provider, full width, stacked. Everything the Overview card shows, plus:

- Wallet address, mono, truncated `ABCD…WXYZ`, click to copy, one-line toast-free confirmation
  (the text changes to `Copied` for 1.5s).
- Jobs it can do, as chips.
- `Registered 2h ago`.
- Last 20 calls as a full-width sparkline with a hover tooltip: `14:02:11 · 812ms · delivered`.
- Its own simulation controls, inline, inside the same dashed `SimPanel` treatment.
- When paused: a `--bad` band across the card top reading
  `Paused after 3 failures in a row · retrying in 22s`, with a live countdown.

No table view. Three providers do not need a table, and cards read from further away.

### 8.3 Payments — `/payments`

The full ledger. One table, three filter chips: `All` · `Paid` · `Not paid`.

```
Time      Provider  Amount       Status      Settled in  Notes            Receipt
14:02:11  Beta      0.012 USDC   ● Paid      2.8s        Fee covered      View ↗
14:02:09  Gamma     0.022 USDC   ● Not paid  —           didn't deliver   —
14:02:04  Alpha     0.008 USDC   ● Paid      3.1s        Paid together    View ↗
```

- `Not paid` rows carry `--bad` ink on the status and a plain-English cause in Notes. They are
  never hidden by default.
- The `Not paid` filter is a demo instrument: one click, the whole screen is evidence for
  "payment on delivery, not on request".
- `Receipt` opens the explorer in a new tab. Link text is `View ↗`, never a raw hash — the hash
  lives in a mono sub-line beneath, truncated.
- `Paid together` and `Fee covered` are chips in `--info`. They are the Algorand argument made
  visible without narration (PRD §13, Phase 6).

### 8.4 How it works — `/how`

One screen, no scrolling past two viewport heights. Cut first if Day 2 runs short.

- The five steps as five short paragraphs, same words as the narration.
- One `What we call it / What it actually is` table: Paused → circuit breaker · Score →
  composite score · Receipt → Algorand transaction · Paid together → atomic transaction group ·
  Fee covered → fee abstraction · pay-per-request → x402.
- One paragraph on why Algorand, in PRD §11.2's exact framing.

This page exists so the main pages never have to explain themselves.

### 8.5 Simulation controls

The only human-triggered surface in the product (CLAUDE.md rule 8), and it must be impossible
to mistake for routing logic.

- **Dashed 1px `--line-2` border** — the only dashed border in the app.
- Fill is `--bg`, not `--surface`, so it reads as sitting *behind* the product, not in it.
- Header, always: `Simulation — not part of routing`.
- Buttons are ghost-style, `--ink-2` text, hairline border. No accent fill. They are not
  primary actions.
- Sub-line: `These buttons pretend a provider went down. Routing decisions are never made here.`

---

## 9. Charts

Two chart forms. That is the whole list.

### 9.1 Provider sparkline — last 20 calls

- Single series → **no legend**; the card title names it.
- 2px line, `--spark` (de-emphasised muted). The line is context, not the point.
- Last point: 8px accent dot with a 2px `--surface` ring.
- Failed calls: `--bad` dots, 8px, 2px `--surface` ring. Failures are the readable signal on
  this chart, and they read even when the line is flat.
- No axes, no gridlines, no labels. Hover tooltip on Providers only; Overview cards are
  hover-free (a projector has no hover).
- Plots latency per call. A paused provider's sparkline freezes rather than dropping to zero —
  zero would read as "instant".

### 9.2 Spend vs. baseline — optional, Overview

Cumulative spend against the naive baseline over the session. **Nice-to-have. Cut before
anything else in Phase 5.**

- Two series → legend always present, plus direct end-labels: `Spent` and `If we always used
  the priciest`.
- `--series-1` `#1FA875` for actual spend, `--series-2` `#D95926` for baseline. 2px lines,
  round caps.
- Area fill under the *gap between them* at 10% `--series-1` — the gap is the savings, and it
  is the only thing worth filling.
- Gridlines: horizontal only, 1px solid `--line`, never dashed. Y ticks rounded to clean USDC
  values.
- Axis and label text in `--muted`. **Never in a series colour.**
- One y-axis. Never two.

### 9.3 Chart rules that apply to both

- Text never wears a data colour.
- No number on every point. Label the endpoint only.
- No 3D, no donut, no pie, no dual axis, no animated draw-on.

---

## 10. States

| State | Treatment |
|---|---|
| First load, no data | `EmptyState`: `No requests yet.` Metric tiles show `—`, not `0`. |
| Loading | Nothing for the first 400ms, then one muted line: `Loading…`. No spinner, no skeleton. |
| WS disconnected | `ConnectionPill` → amber, `Reconnecting…`. **Existing data stays on screen.** Never blank the page, never a modal. |
| Router unreachable | Pill → red, `Router unreachable`. One muted line under the nav. Page stays rendered. |
| Provider paused | Card gets a `--bad` top band + countdown. It is never removed from the strip. |
| Request turned down (402) | Narration step 2 in amber, feed row with a `Turned down` chip. Not an error state — this is the budget working. |
| No providers (503) | Feed row, `--bad`, `All 3 providers are paused.` |

Rule: **a failure of the system is never rendered the same way as a decision by the system.**
A 402 "over budget" is the product succeeding and reads amber-neutral; a router crash reads red.

---

## 11. Accessibility & the projector

The room is the real constraint. Someone will be watching this from 12 metres on a washed-out
projector.

- Body text ≥ 16px. Nothing meaningful below 13px.
- Text contrast ≥ 4.5:1 against its surface. Borders and marks that carry meaning ≥ 3:1.
- **No information conveyed by colour alone, anywhere.** Status is dot + word. Series are
  legend + direct label. The winner is a wash + a `Best` chip + position.
- **No hover-only information on Overview.** Projectors have no cursor. Hover may supplement on
  Providers and Payments; it may never be the only path to a value.
- Focus ring: 2px `--accent-line`, 2px offset, on every interactive element. Keyboard order
  follows visual order.
- Target 1920×1080 and 1440×900. Below 1100px the grid stacks to one column so nothing breaks,
  but mobile is explicitly not designed for (PRD §16).
- `prefers-reduced-motion` honoured (§6.4).

---

## 12. Anti-patterns — do not build

Each of these is a real temptation and each costs demo time or credibility.

- A theme toggle. A settings page. A login. A user menu. (PRD §16.)
- Gradients, glassmorphism, backdrop blur on cards, glow effects, neon.
- Shadows for elevation.
- Emoji as icons. An icon library dependency. Icons without labels.
- Animated counters on anything but `Saved`.
- Skeleton shimmer.
- Toasts, especially stacked ones. Modals. Confirmation dialogs.
- A "show more" that hides rejected candidates.
- Charts nobody asked for. A third chart type.
- Any word from the §4.2 ban list on a main page.
- Progress that isn't real progress.
- Terminal-green-on-black "hacker" styling. It reads as a toy, and the point is that this looks
  like infrastructure.

---

## 13. Implementation notes

### 13.1 Tokens — Tailwind v4

`dashboard/src/index.css`, extending the existing `@import 'tailwindcss'`:

```css
@import 'tailwindcss';

@theme {
  --color-bg: #0a0b0d;
  --color-surface: #121418;
  --color-surface-2: #171a1f;
  --color-line: #22262d;
  --color-line-2: #2c313a;
  --color-ink: #eceef2;
  --color-ink-2: #b6bcc7;
  --color-muted: #7d8492;
  --color-faint: #565c68;

  --color-accent: #3ecf8e;
  --color-ok: #3ecf8e;
  --color-warn: #f5c451;
  --color-bad: #f0736a;
  --color-info: #8ab4f8;

  --color-series-1: #1fa875;
  --color-series-2: #d95926;
  --color-spark: #7d8492;

  --font-sans: Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  --font-mono: ui-monospace, 'Cascadia Code', 'SF Mono', Menlo, Consolas, monospace;

  --radius-card: 8px;
  --radius-control: 6px;
  --radius-chip: 4px;

  --ease-base: cubic-bezier(0.2, 0, 0, 1);
}
```

### 13.2 Files

```
dashboard/src/
├── main.tsx
├── App.tsx                  # nav + 4 routes
├── index.css                # tokens above
├── lib/
│   ├── ws.ts                # WS /v1/events, auto-reconnect w/ backoff
│   ├── labels.ts            # §4.1 translation table — SINGLE SOURCE
│   ├── narrate.ts           # event → Step[] — SINGLE SOURCE (mirrors explain.ts)
│   └── format.ts            # re-exports formatMicroUSDC, adds formatMs, formatAgo
├── components/              # the thirteen from §7
└── pages/
    ├── Overview.tsx
    ├── Providers.tsx
    ├── Payments.tsx
    └── HowItWorks.tsx
```

`labels.ts` and `narrate.ts` are the design system's teeth. **No component writes a status word
or a narration sentence inline.** If a judge asks "where does that text come from", the answer
is one file — same guarantee CLAUDE.md already makes for `explainDecision()`.

Routing: `react-router-dom`, four routes, no lazy loading, no layout nesting beyond the nav.

### 13.3 Build order within Phase 5

1. `ws.ts` + `labels.ts` + `format.ts` — the plumbing that everything reads through.
2. `narrate.ts` + `NarrationPanel` — the centrepiece. Get this right before anything is styled.
3. Overview metric row + `HeroStat`.
4. Provider strip + `Sparkline`.
5. Decision feed + `CandidateTable` (rejected rows are not optional).
6. Payments preview + `SimPanel`.
7. Providers page, Payments page.
8. *How it works*, spend-vs-baseline chart — both cut-first.

### 13.4 Cut order

If Phase 5 runs long, cut in this order and stop when you fit:

1. *How it works* page
2. Spend-vs-baseline chart
3. Payments page (keep the Overview preview)
4. Providers page (keep the Overview strip)

**Never cut:** the narration panel, rejected candidates, the `Not paid` status, the `Saved`
hero. Those four are the demo.

---

## 14. Decisions log

| Date | Decision | Why |
|---|---|---|
| 2026-07-31 | Four pages instead of PRD §12's single page | Answering a judge's follow-up beats scrolling. Demo never leaves Overview, so the §14 script is unaffected. |
| 2026-07-31 | Narration is a first-class system, not a log | It is the anti-complexity argument made visible. Also the cheapest way to explain x402 to a room. |
| 2026-07-31 | Minimum 350ms step dwell, real timings displayed | A 3ms decision is unreadable. Pacing the render is a reading aid; faking the number would be a lie. |
| 2026-07-31 | Score shown raw, never inverted or rescaled | A judge may read `scorer.ts` on stage. The screen number must equal the code number. |
| 2026-07-31 | Chart series darker than the UI accent | `#3ECF8E` fails the dark-surface lightness band as a data mark. `#1FA875` + `#D95926` validated. |
| 2026-07-31 | No webfonts | Venue wifi is a listed risk. A FOUT on the projector is unrecoverable. |
| 2026-07-31 | Status is always dot **and** word | `--ok` vs `--warn` measure ΔE 7.4 under protanopia — below threshold. The word is the mitigation. |
