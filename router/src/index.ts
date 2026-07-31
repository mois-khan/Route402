import Fastify from 'fastify';
import { config, missingChainConfig } from './config.js';
import { db, ledgerCounts, closeDb } from './ledger/db.js';

/**
 * Route402 router.
 *
 * Phase 0: boots, opens the ledger, answers /health. Routing, scoring and
 * settlement arrive in Phases 2-4 — do not add them here ahead of schedule.
 */

const app = Fastify({
  logger: {
    transport: { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname' } },
  },
});

app.get('/health', async () => {
  const pending = missingChainConfig();
  return {
    status: 'ok',
    service: 'router',
    network: config.network,
    ledger: ledgerCounts(),
    // Empty until Phase 3. Shown so a failed settlement has an obvious first suspect.
    chainConfigMissing: pending,
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
  await app.listen({ port: config.routerPort, host: '0.0.0.0' });
  app.log.info(`ledger ready at ${config.dbPath} · network=${config.network}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
