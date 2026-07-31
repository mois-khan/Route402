import Fastify from 'fastify';
import { config, missingChainConfig } from './config.js';
import { db, ledgerCounts, closeDb } from './ledger/db.js';
import { registry } from './registry.js';
import { seedKnownProviders } from './seed.js';
import { initEvents } from './events.js';
import { registerFacilitatorRoutes } from './routes/facilitator.js';
import { registerRouteRoute } from './routes/route.js';
import { registerProvidersRoutes } from './routes/providers.js';
import { registerDecisionsRoute } from './routes/decisions.js';
import { registerStatsRoute } from './routes/stats.js';

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

registerFacilitatorRoutes(app);
registerRouteRoute(app);
registerProvidersRoutes(app);
registerDecisionsRoute(app);
registerStatsRoute(app);

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
  db(); // fail fast if the ledger cannot be opened
  registry.hydrate();
  seedKnownProviders();
  await app.listen({ port: config.routerPort, host: '0.0.0.0' });
  initEvents(app.server);
  app.log.info(`ledger ready at ${config.dbPath} · network=${config.network} · providers=${registry.getAll().length}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
