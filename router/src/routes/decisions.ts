import type { FastifyInstance } from 'fastify';
import { getRecentDecisions, getRecentPayments } from '../ledger/db.js';

/** PRD §10.1 — `GET /v1/decisions?limit=50`, and the settlement ledger the Payments page and Overview preview read. */
export function registerDecisionsRoute(app: FastifyInstance): void {
  app.get<{ Querystring: { limit?: string } }>('/v1/decisions', async (req) => {
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
    return getRecentDecisions(limit);
  });

  app.get<{ Querystring: { limit?: string } }>('/v1/payments', async (req) => {
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
    return getRecentPayments(limit);
  });
}
