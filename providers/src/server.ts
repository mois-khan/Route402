import express from 'express';
import type { Request, Response } from 'express';
import { loadProfile, loadTranslateProfile } from './profiles.js';
import { createChaos, isChaosMode, GARBAGE_BODY } from './chaos.js';
import { x402Gate, usdcAsaId } from './x402-gate.js';
import { verifyCompositeProof } from './compositeProof.js';

/**
 * One Express template, instantiated three times with different config:
 *   tsx providers/src/server.ts alpha|beta|gamma
 *
 * Phase 1 built the capability handler, latency simulation and chaos modes.
 * Phase 3 adds x402-gate.ts in front of the same handler. Phase 6 adds a
 * second capability (translate) on the same process, and a second way to
 * get paid for either one — the normal per-request x402 handshake, or a
 * proof that a router-built composite group already paid this leg
 * (compositeProof.ts) — everything below the gate is otherwise unchanged
 * from Phase 1.
 */

const key = process.argv[2];
const profile = loadProfile(key);
const translateProfile = loadTranslateProfile(key);
const chaos = createChaos();
const app = express();

app.use(express.json({ limit: '1mb' }));

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Naive stand-in for a real summarizer. Fidelity doesn't matter here — the demo is the routing, not the NLP. */
function summarize(text: string, maxWords: number): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return words.join(' ');
  return words.slice(0, maxWords).join(' ') + '…';
}

/** Naive stand-in for a real translator, same reasoning as summarize(). */
function translate(text: string): string {
  return `[translated] ${text.trim()}`;
}

async function handleSummarize(req: Request, res: Response): Promise<void> {
  const delayMs = chaos.delayMs(profile);
  await sleep(delayMs);

  res.setHeader('X-Price-MicroUSDC', String(profile.advertisedPriceMicroUSDC));

  if (chaos.mode === 'garbage') {
    // Non-2xx, not 200 — see chaos.ts. x402 settlement is gated on HTTP
    // status alone, so a literal 200-with-nothing would be paid by the
    // protocol itself before the router's guard ever ran. This provider
    // self-checks and refuses to claim success it can't back up; the
    // router's guard (Phase 4) is the independent second check.
    res.status(502).json({ error: 'empty_result', message: `${profile.id} produced no usable output`, ...GARBAGE_BODY });
    return;
  }

  const text = typeof req.body?.text === 'string' ? req.body.text : '';
  if (!text.trim()) {
    res.status(400).json({ error: 'invalid_payload', message: 'payload.text is required' });
    return;
  }
  const maxWords = Number.isFinite(req.body?.maxWords) ? Math.max(5, Math.min(200, req.body.maxWords)) : 60;

  res.status(200).json({ summary: summarize(text, maxWords) });
}

async function handleTranslate(req: Request, res: Response): Promise<void> {
  const timing = { latencyP50Ms: translateProfile.latencyP50Ms, latencyP95Ms: translateProfile.latencyP95Ms, maxTimeoutSeconds: profile.maxTimeoutSeconds };
  const delayMs = chaos.delayMs(timing);
  await sleep(delayMs);

  res.setHeader('X-Price-MicroUSDC', String(translateProfile.advertisedPriceMicroUSDC));

  if (chaos.mode === 'garbage') {
    res.status(502).json({ error: 'empty_result', message: `${translateProfile.id} produced no usable output`, translation: '' });
    return;
  }

  const text = typeof req.body?.text === 'string' ? req.body.text : '';
  if (!text.trim()) {
    res.status(400).json({ error: 'invalid_payload', message: 'payload.text is required' });
    return;
  }

  res.status(200).json({ translation: translate(text) });
}

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    id: profile.id,
    name: profile.name,
    capability: profile.capabilities[0],
    priceMicroUSDC: profile.advertisedPriceMicroUSDC,
    // Additive, not part of the PRD §10.2 contract: lets a judge (or curl) see
    // the current failure mode without a separate round trip during a demo.
    chaosMode: chaos.mode,
  });
});

// Demo control. The only human-triggered action on the provider side — it
// simulates an external event (the service degrading), not a routing choice.
app.post('/_chaos', (req, res) => {
  const mode = req.body?.mode;
  if (!isChaosMode(mode)) {
    res.status(400).json({ error: 'invalid_mode', message: `mode must be one of healthy, offline, slow, garbage` });
    return;
  }
  chaos.set(mode);
  console.log(`[${profile.id}] chaos → ${mode}`);
  res.json({ id: profile.id, mode: chaos.mode, since: chaos.since });
});

app.get('/_chaos', (_req, res) => {
  res.json({ id: profile.id, mode: chaos.mode, since: chaos.since });
});

// `offline` models connection-refused / service-down — ahead of both payment
// paths, so an "offline" provider refuses before any payment negotiation or
// proof check even starts. Covers both capability paths this process
// serves. The process itself stays up (so the chaos switch and /health
// keep working); this is the closest honest simulation from inside a route
// that's still listening.
const CAPABILITY_PATHS: Record<string, { payTo: string; advertisedPriceMicroUSDC: number; handler: (req: Request, res: Response) => Promise<void> }> = {
  [profile.path]: { payTo: profile.walletAddress, advertisedPriceMicroUSDC: profile.advertisedPriceMicroUSDC, handler: handleSummarize },
  [translateProfile.path]: { payTo: profile.walletAddress, advertisedPriceMicroUSDC: translateProfile.advertisedPriceMicroUSDC, handler: handleTranslate },
};

app.use((req, res, next) => {
  if (req.path in CAPABILITY_PATHS && chaos.mode === 'offline') {
    res.status(503).json({ error: 'service_unavailable', message: `${profile.id} is offline` });
    return;
  }
  next();
});

// Phase 6 (US8) composite path: a router-built atomic group already paid
// this leg (payment/composite.ts on the router side) — no per-provider x402
// handshake happens for these, so this checks the proof directly against
// algod instead of going through x402Gate. Absent the header, falls through
// to the normal x402Gate flow untouched.
app.use(async (req, res, next) => {
  const proofTxId = req.header('X-Route402-Proof-Tx');
  const route = CAPABILITY_PATHS[req.path];
  if (!proofTxId || !route) {
    next();
    return;
  }

  const check = await verifyCompositeProof(proofTxId, route.payTo, route.advertisedPriceMicroUSDC, Number(usdcAsaId));
  if (!check.ok) {
    res.status(402).json({ error: 'invalid_proof', message: check.reason });
    return;
  }
  await route.handler(req, res);
});

app.use(
  x402Gate([
    {
      path: profile.path,
      capability: profile.capabilities[0],
      name: profile.name,
      advertisedPriceMicroUSDC: profile.advertisedPriceMicroUSDC,
      walletAddress: profile.walletAddress,
      maxTimeoutSeconds: profile.maxTimeoutSeconds,
    },
    {
      path: translateProfile.path,
      capability: 'text.translate',
      name: translateProfile.name,
      advertisedPriceMicroUSDC: translateProfile.advertisedPriceMicroUSDC,
      // Same wallet as the summarize leg — this is the same provider, a
      // second capability, not a second entity.
      walletAddress: profile.walletAddress,
      maxTimeoutSeconds: profile.maxTimeoutSeconds,
    },
  ])
);

app.post(profile.path, handleSummarize);
app.post(translateProfile.path, handleTranslate);

app.listen(profile.port, () => {
  console.log(
    `[${profile.id}] ${profile.name} listening on :${profile.port}` +
      ` · ${profile.advertisedPriceMicroUSDC} µUSDC · ~${profile.latencyP50Ms}ms p50` +
      ` · ${translateProfile.name} ${translateProfile.advertisedPriceMicroUSDC} µUSDC · ~${translateProfile.latencyP50Ms}ms p50`
  );
});
