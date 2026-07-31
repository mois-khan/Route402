import Fastify from 'fastify';
import { config, missingChainConfig } from './config.js';
import { db, ledgerCounts, closeDb } from './ledger/db.js';
import { registry } from './registry.js';
import { seedKnownProviders } from './seed.js';
import { initEvents } from './events.js';
import { registerFacilitatorRoutes } from './routes/facilitator.js';
import { registerRouteRoute } from './routes/route.js';
import { registerCompositeRoute } from './routes/composite.js';
import { registerProvidersRoutes } from './routes/providers.js';
import { registerDecisionsRoute } from './routes/decisions.js';
import { registerStatsRoute } from './routes/stats.js';
import { registerWalletsRoute } from './routes/wallets.js';

/**
 * Route402 router.
 *
 * Phase 0-4 built boot, the ledger, the registry, the scorer, the
 * self-hosted x402 facilitator and the guarded fallback loop. Phase 5 adds
 * the read routes and the WebSocket event stream the dashboard runs on.
 */

// pino-pretty spawns a worker thread to format logs — fine on a laptop, but it can
// hang silently on startup inside some containers. Plain JSON logging in production
// sidesteps that risk entirely.
const app = Fastify({
  logger:
    process.env.NODE_ENV === 'production'
      ? true
      : {
          transport: { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname' } },
        },
});

// Dashboard runs on its own origin once deployed (Railway gives each service its
// own domain) — no auth/session in this project (PRD §16), so an open CORS policy
// costs nothing and keeps a second reverse proxy out of scope.
app.addHook('onRequest', async (_req, reply) => {
  reply.header('Access-Control-Allow-Origin', '*');
  reply.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  reply.header('Access-Control-Allow-Headers', 'content-type');
});
app.options('/*', async (_req, reply) => {
  reply.code(204).send();
});

registerFacilitatorRoutes(app);
registerRouteRoute(app);
registerCompositeRoute(app);
registerProvidersRoutes(app);
registerDecisionsRoute(app);
registerStatsRoute(app);
registerWalletsRoute(app);

app.get('/health', async () => {
  const pending = missingChainConfig();
  return {
    status: 'ok',
    service: 'router',
    network: config.network,
    ledger: ledgerCounts(),
    // Shown so a failed settlement has an obvious first suspect.
    chainConfigMissing: pending,
    providers: registry.getAll().length,
    uptimeMs: Math.round(process.uptime() * 1000),
  };
});

const shutdown = async (signal: string) => {
  app.log.info(`${signal} received, shutting down`);
  await app.close();
  closeDb();
  process.exit(0);
};
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

try {
  console.error('[boot] opening ledger…');
  db(); // fail fast if the ledger cannot be opened
  console.error('[boot] ledger open, hydrating registry…');
  registry.hydrate();
  console.error('[boot] registry hydrated, seeding known providers…');
  seedKnownProviders();
  console.error('[boot] seeded, binding port ' + config.routerPort + '…');
  await app.listen({ port: config.routerPort, host: '0.0.0.0' });
  console.error('[boot] listening, wiring events…');
  initEvents(app.server);
  console.error('[boot] done');
  app.log.info(`ledger ready at ${config.dbPath} · network=${config.network} · providers=${registry.getAll().length}`);
} catch (err) {
  console.error('[boot] threw:', err);
  app.log.error(err);
  process.exit(1);
}
