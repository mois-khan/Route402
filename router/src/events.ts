import type { Server } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import type { RouterEvent } from '@route402/shared';

/**
 * WS /v1/events — PRD §10.1. Broadcasts `decision | payment | call | circuit | stats`
 * to every connected client. No per-client filtering, no request/response —
 * dashboard clients (Phase 5) just listen.
 */

let wss: WebSocketServer | null = null;

export function initEvents(server: Server): void {
  wss = new WebSocketServer({ server, path: '/v1/events' });
}

export function broadcast(event: RouterEvent): void {
  if (!wss) return;
  const payload = JSON.stringify(event);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) client.send(payload);
  }
}
