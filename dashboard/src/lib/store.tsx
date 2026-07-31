import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Provider, CallRecord, ChaosMode, RouterEvent } from '@route402/shared';
import type { DecisionWithPriority, StatsSnapshot, CallSummary, PaymentWithCreatedAt, WalletBalances } from './types.js';
import { createEventsClient, type ConnectionState } from './ws.js';

interface Store {
  providers: Provider[];
  decisions: DecisionWithPriority[];
  payments: PaymentWithCreatedAt[];
  calls: CallSummary[];
  stats: StatsSnapshot | null;
  wallets: WalletBalances | null;
  connectionState: ConnectionState;
  /** The most recently broadcast decision's id — drives the "Right now" panel. */
  latestDecisionId: string | null;
  sendChaos: (providerId: string, mode: ChaosMode) => Promise<void>;
  sendLoad: (count: number) => Promise<void>;
}

const StoreContext = createContext<Store | null>(null);

const MAX_DECISIONS = 50;
const MAX_PAYMENTS = 50;
const MAX_CALLS = 500;
const PROVIDER_REFRESH_DEBOUNCE_MS = 400;

const SAMPLE_TEXTS = [
  'The quick brown fox jumps over the lazy dog near the river bank at dawn.',
  'An agent that can pay for things itself no longer needs a human to pick a provider.',
  'Algorand settles in a few seconds, which is what makes routing inside one HTTP request possible.',
  'Route402 scores every candidate on price, speed and reliability before it spends a single microUSDC.',
  'A provider that does not deliver a real result is never paid for the attempt.',
];

// Same-origin ('') when the dashboard is served from behind the router's own
// domain (local dev, via vite.config.ts's proxy). Deployed separately, the
// dashboard needs the router's actual URL — see .env.example.
const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

async function getJSON<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [decisions, setDecisions] = useState<DecisionWithPriority[]>([]);
  const [payments, setPayments] = useState<PaymentWithCreatedAt[]>([]);
  const [calls, setCalls] = useState<CallSummary[]>([]);
  const [stats, setStats] = useState<StatsSnapshot | null>(null);
  const [wallets, setWallets] = useState<WalletBalances | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>('connecting');
  const [latestDecisionId, setLatestDecisionId] = useState<string | null>(null);
  const clientRef = useRef(createEventsClient());
  const refreshProvidersTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshProviders = () => {
    if (refreshProvidersTimer.current) clearTimeout(refreshProvidersTimer.current);
    refreshProvidersTimer.current = setTimeout(() => {
      getJSON<Provider[]>('/v1/providers').then(setProviders).catch(() => {});
      // Sponsor's ALGO balance drains with every settled group's fee — same
      // debounce window as the provider counters that moved in the same request.
      getJSON<WalletBalances>('/v1/wallets').then(setWallets).catch(() => {});
    }, PROVIDER_REFRESH_DEBOUNCE_MS);
  };

  useEffect(() => {
    Promise.all([
      getJSON<Provider[]>('/v1/providers'),
      getJSON<DecisionWithPriority[]>('/v1/decisions?limit=50'),
      getJSON<PaymentWithCreatedAt[]>('/v1/payments?limit=50'),
      getJSON<CallSummary[]>('/v1/calls?limit=500'),
      getJSON<StatsSnapshot>('/v1/stats'),
      getJSON<WalletBalances>('/v1/wallets'),
    ])
      .then(([p, d, pay, c, s, w]) => {
        setProviders(p);
        setDecisions(d);
        setPayments(pay);
        setCalls(c);
        setStats(s);
        setWallets(w);
      })
      .catch(() => {
        // WS connection state already surfaces "router unreachable"; the
        // initial load just stays empty and EmptyState covers it.
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onEvent = (event: RouterEvent) => {
      switch (event.type) {
        case 'decision': {
          const decision = event.data as DecisionWithPriority;
          setDecisions((prev) => [decision, ...prev.filter((d) => d.id !== decision.id)].slice(0, MAX_DECISIONS));
          setLatestDecisionId(decision.id);
          refreshProviders(); // latency/success counters moved
          break;
        }
        case 'payment': {
          const payment = event.data as PaymentWithCreatedAt;
          setPayments((prev) => [payment, ...prev.filter((p) => p.id !== payment.id)].slice(0, MAX_PAYMENTS));
          if (payment.status === 'settled') refreshProviders(); // sponsor's ALGO balance moved
          break;
        }
        case 'circuit': {
          const { providerId, circuitState } = event.data as { providerId: string; circuitState: Provider['circuitState'] };
          setProviders((prev) => prev.map((p) => (p.id === providerId ? { ...p, circuitState } : p)));
          break;
        }
        case 'stats': {
          setStats(event.data as StatsSnapshot);
          break;
        }
        case 'call': {
          const call = event.data as CallRecord;
          setCalls((prev) =>
            [{ providerId: call.providerId, latencyMs: call.latencyMs, failed: call.outcome !== 'success', startedAt: call.startedAt }, ...prev].slice(
              0,
              MAX_CALLS
            )
          );
          break;
        }
      }
    };
    return clientRef.current.subscribe(onEvent, setConnectionState);
  }, []);

  const sendChaos = async (providerId: string, mode: ChaosMode) => {
    await fetch(`${API_BASE}/v1/providers/${providerId}/chaos`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mode }),
    });
    getJSON<Provider[]>('/v1/providers').then(setProviders).catch(() => {});
  };

  const sendLoad = async (count: number) => {
    const priorities = ['cost', 'speed', 'balanced'] as const;
    for (let i = 0; i < count; i++) {
      void fetch(`${API_BASE}/v1/route`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          capability: 'text.summarize',
          payload: { text: SAMPLE_TEXTS[i % SAMPLE_TEXTS.length], maxWords: 40 },
          constraints: { priority: priorities[i % priorities.length] },
          agentId: 'agent_demo_load',
        }),
      }).catch(() => {});
      // Staggered, not slammed — the point is a readable feed, not a stress test.
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  };

  return (
    <StoreContext.Provider value={{ providers, decisions, payments, calls, stats, wallets, connectionState, latestDecisionId, sendChaos, sendLoad }}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStore(): Store {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}
