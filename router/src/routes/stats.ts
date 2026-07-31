import type { FastifyInstance } from 'fastify';
import { computeStats } from '../ledger/db.js';

/** PRD §10.1 — `GET /v1/stats`, the PRD §8.6 SavingsSnapshot the dashboard's headline row reads. */
export function registerStatsRoute(app: FastifyInstance): void {
  app.get('/v1/stats', async () => computeStats());
}
