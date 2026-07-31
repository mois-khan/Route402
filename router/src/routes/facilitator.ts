import type { FastifyInstance } from 'fastify';
import type { PaymentPayload, PaymentRequirements } from '@x402/core/types';
import { facilitator } from '../payment/facilitator.js';

/**
 * Route402's self-hosted x402 facilitator, over HTTP.
 *
 * Mirrors the exact request/response shape @x402/core's own
 * `HTTPFacilitatorClient` sends and expects (confirmed against its compiled
 * source, docs/VERIFY.md #5/#6) — so the providers' `paymentMiddlewareFromConfig`
 * (an unmodified `FacilitatorClient` pointed at `FACILITATOR_URL`) talks to
 * this exactly as it would talk to any hosted facilitator.
 */

interface FacilitatorRequestBody {
  x402Version: number;
  paymentPayload: PaymentPayload;
  paymentRequirements: PaymentRequirements;
}

export function registerFacilitatorRoutes(app: FastifyInstance): void {
  app.get('/facilitator/supported', async () => facilitator().getSupported());

  app.post<{ Body: FacilitatorRequestBody }>('/facilitator/verify', async (req, reply) => {
    try {
      return await facilitator().verify(req.body.paymentPayload, req.body.paymentRequirements);
    } catch (err) {
      app.log.error(err, 'facilitator verify failed');
      reply.code(500);
      return { isValid: false, invalidReason: err instanceof Error ? err.message : 'verify failed' };
    }
  });

  app.post<{ Body: FacilitatorRequestBody }>('/facilitator/settle', async (req, reply) => {
    try {
      return await facilitator().settle(req.body.paymentPayload, req.body.paymentRequirements);
    } catch (err) {
      app.log.error(err, 'facilitator settle failed');
      reply.code(500);
      return {
        success: false,
        errorReason: 'settlement_failed',
        errorMessage: err instanceof Error ? err.message : 'settle failed',
        transaction: '',
        network: req.body.paymentRequirements.network,
      };
    }
  });
}
