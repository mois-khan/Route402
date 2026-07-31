import express from 'express';
import { loadProfile } from './profiles.js';

/**
 * One Express template, instantiated three times with different config:
 *   tsx providers/src/server.ts alpha|beta|gamma
 *
 * Phase 0: health only. The capability handler, latency simulation, chaos
 * modes and the x402 gate arrive in Phases 1 and 3.
 */

const profile = loadProfile(process.argv[2]);
const app = express();

app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    id: profile.id,
    name: profile.name,
    capability: profile.capabilities[0],
    priceMicroUSDC: profile.advertisedPriceMicroUSDC,
  });
});

app.listen(profile.port, () => {
  console.log(
    `[${profile.id}] ${profile.name} listening on :${profile.port}` +
      ` · ${profile.advertisedPriceMicroUSDC} µUSDC · ~${profile.latencyP50Ms}ms p50`
  );
});
