import type { FastifyInstance } from 'fastify';
import { isChaosMode } from '@route402/shared';
import { registry } from '../registry.js';

/**
 * PRD §10.1 — `GET /v1/providers` (dashboard's provider panel) and
 * `POST /v1/providers/:id/chaos` (the one human-triggered endpoint in the
 * system — simulates an external event, not a routing decision).
 */
export function registerProvidersRoutes(app: FastifyInstance): void {
  app.get('/v1/providers', async () => registry.getAll());

  app.post<{ Params: { id: string }; Body: { mode?: string } }>('/v1/providers/:id/chaos', async (req, reply) => {
    const provider = registry.get(req.params.id);
    if (!provider) {
      reply.code(404);
      return { error: 'not_found', message: `Unknown provider "${req.params.id}"` };
    }
    if (!isChaosMode(req.body?.mode)) {
      reply.code(400);
      return { error: 'invalid_mode', message: 'mode must be one of healthy, offline, slow, garbage' };
    }

    // The provider owns its own capability path; chaos control lives at the
    // same host on a fixed sibling path.
    const chaosUrl = new URL(provider.endpoint);
    chaosUrl.pathname = '/_chaos';

    const res = await fetch(chaosUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mode: req.body.mode }),
    });
    if (!res.ok) {
      reply.code(502);
      return { error: 'provider_unreachable', message: `Could not reach ${provider.id} to change its chaos mode.` };
    }
    return res.json();
  });
}
