import type { RouterEvent } from '@route402/shared';

/** DESIGN.md's `ConnectionPill` states. */
export type ConnectionState = 'connecting' | 'connected' | 'reconnecting' | 'unreachable';

export interface EventsClient {
  subscribe(onEvent: (event: RouterEvent) => void, onState: (state: ConnectionState) => void): () => void;
}

const MAX_BACKOFF_MS = 8000;

/** WS /v1/events, auto-reconnect with exponential backoff. One shared connection for the whole app. */
export function createEventsClient(): EventsClient {
  const eventListeners = new Set<(event: RouterEvent) => void>();
  const stateListeners = new Set<(state: ConnectionState) => void>();
  let socket: WebSocket | null = null;
  let backoffMs = 500;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let everConnected = false;
  let stopped = false;

  const setState = (state: ConnectionState) => {
    for (const listener of stateListeners) listener(state);
  };

  // Same-origin fallback matches getJSON's default in store.tsx.
  const apiBase = import.meta.env.VITE_API_BASE_URL || `${window.location.protocol}//${window.location.host}`;
  const wsBase = apiBase.replace(/^http/, 'ws'); // http(s):// -> ws(s)://

  const connect = () => {
    if (stopped) return;
    socket = new WebSocket(`${wsBase}/v1/events`);

    socket.addEventListener('open', () => {
      backoffMs = 500;
      everConnected = true;
      setState('connected');
    });

    socket.addEventListener('message', (msg) => {
      try {
        const event = JSON.parse(msg.data as string) as RouterEvent;
        for (const listener of eventListeners) listener(event);
      } catch {
        // Malformed frame — ignore rather than crash the whole panel.
      }
    });

    socket.addEventListener('close', () => {
      if (stopped) return;
      setState(everConnected ? 'reconnecting' : 'unreachable');
      reconnectTimer = setTimeout(connect, backoffMs);
      backoffMs = Math.min(backoffMs * 2, MAX_BACKOFF_MS);
    });

    socket.addEventListener('error', () => {
      socket?.close();
    });
  };

  return {
    subscribe(onEvent, onState) {
      eventListeners.add(onEvent);
      stateListeners.add(onState);
      if (!socket) {
        setState('connecting');
        connect();
      }
      return () => {
        eventListeners.delete(onEvent);
        stateListeners.delete(onState);
      };
    },
  };
}
