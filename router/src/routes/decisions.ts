import type { FastifyInstance } from 'fastify';
import { getRecentDecisions, getRecentPayments, getRecentCalls } from '../ledger/db.js';

/** PRD §10.1 — `GET /v1/decisions?limit=50`, plus the settlement ledger and call history the dashboard (Phase 5) reads. */
export function registerDecisionsRoute(app: FastifyInstance): void {
  app.get<{ Querystring: { limit?: string } }>('/v1/decisions', async (req) => {
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
    return getRecentDecisions(limit);
  });

  app.get<{ Querystring: { limit?: string } }>('/v1/payments', async (req) => {
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
    return getRecentPayments(limit);
  });

  app.get<{ Querystring: { limit?: string } }>('/v1/calls', async (req) => {
    const limit = Math.min(1000, Math.max(1, Number(req.query.limit) || 500));
    return getRecentCalls(limit);
  });
}
