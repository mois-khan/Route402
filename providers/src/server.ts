import express from 'express';
import { loadProfile } from './profiles.js';
import { createChaos, isChaosMode, GARBAGE_BODY } from './chaos.js';

/**
 * One Express template, instantiated three times with different config:
 *   tsx providers/src/server.ts alpha|beta|gamma
 *
 * Phase 1: the capability handler, latency simulation and chaos modes.
 * Still no blockchain — every call is served for free. The 402 handshake
 * arrives in Phase 3's x402-gate.ts, in front of this same handler.
 */

const profile = loadProfile(process.argv[2]);
const chaos = createChaos(profile);
const app = express();

app.use(express.json({ limit: '1mb' }));

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Naive stand-in for a real summarizer. Fidelity doesn't matter here — the demo is the routing, not the NLP. */
function summarize(text: string, maxWords: number): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return words.join(' ');
  return words.slice(0, maxWords).join(' ') + '…';
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

app.post(profile.path, async (req, res) => {
  // `offline` models connection-refused / service-down. The process is still
  // up (so the chaos switch keeps working), so the closest honest simulation
  // from inside the handler is an immediate 503 rather than the sleep every
  // other mode takes.
  if (chaos.mode === 'offline') {
    res.status(503).json({ error: 'service_unavailable', message: `${profile.id} is offline` });
    return;
  }

  const delayMs = chaos.delayMs();
  await sleep(delayMs);

  res.setHeader('X-Price-MicroUSDC', String(profile.advertisedPriceMicroUSDC));

  if (chaos.mode === 'garbage') {
    // 200 OK, correct shape, nothing inside. This is what the payment guard
    // (Phase 4) exists to catch — a provider that "succeeds" at doing nothing.
    res.status(200).json(GARBAGE_BODY);
    return;
  }

  const text = typeof req.body?.text === 'string' ? req.body.text : '';
  if (!text.trim()) {
    res.status(400).json({ error: 'invalid_payload', message: 'payload.text is required' });
    return;
  }
  const maxWords = Number.isFinite(req.body?.maxWords) ? Math.max(5, Math.min(200, req.body.maxWords)) : 60;

  res.status(200).json({ summary: summarize(text, maxWords) });
});

app.listen(profile.port, () => {
  console.log(
    `[${profile.id}] ${profile.name} listening on :${profile.port}` +
      ` · ${profile.advertisedPriceMicroUSDC} µUSDC · ~${profile.latencyP50Ms}ms p50`
  );
});
