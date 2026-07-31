import type { Provider } from '@route402/shared';
import { loadProviders, upsertProvider } from './ledger/db.js';
import { onSuccess, onFailure, withCooldown } from './breaker.js';
import { broadcast } from './events.js';

/** PRD §9.6 cold-start default for a provider that declares no latency of its own. */
const DEFAULT_COLD_START_P50_MS = 1000;
const LATENCY_WINDOW = 20;

export interface RegisterInput {
  id: string;
  name: string;
  endpoint: string;
  capabilities: string[];
  advertisedPriceMicroUSDC: number;
  walletAddress: string;
  /**
   * Internal-only seed for Route402's own three demo providers, whose real
   * price/latency profile is already known (`providers/src/profiles.ts`).
   * A genuine third-party self-registration (PRD §10.1 `POST /v1/providers`)
   * never sends this — the §9.6 cold-start default applies instead.
   */
  seedLatencyP50Ms?: number;
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

/**
 * In-memory provider pool, write-through to SQLite. Owns the mutable state
 * the pure `scorer.ts` reads: capabilities, price, rolling latency, circuit
 * state. Never imported by the scorer — only ever the other way around.
 */
export class Registry {
  private providers = new Map<string, Provider>();
  private latencyWindows = new Map<string, number[]>();
  /** Ids currently probing a half-open breaker. Enforces "one probe at a time" (PRD plan, Phase 2 breaker.ts) once the fallback loop (Phase 4) starts consuming it. */
  private probing = new Set<string>();

  /** Resume from the ledger after a restart instead of starting cold. */
  hydrate(): void {
    for (const p of loadProviders()) {
      this.providers.set(p.id, p);
      this.latencyWindows.set(p.id, []);
    }
  }

  register(input: RegisterInput): Provider {
    const latencyP50Ms = input.seedLatencyP50Ms ?? DEFAULT_COLD_START_P50_MS;
    const provider: Provider = {
      id: input.id,
      name: input.name,
      endpoint: input.endpoint,
      capabilities: input.capabilities,
      advertisedPriceMicroUSDC: input.advertisedPriceMicroUSDC,
      walletAddress: input.walletAddress,
      registeredAt: Date.now(),
      latencyP50Ms,
      latencyP95Ms: latencyP50Ms * 2,
      successCount: 1, // optimistic prior — new providers get sampled, not starved
      failureCount: 0,
      circuitState: 'closed',
      circuitOpenedAt: null,
      consecutiveFailures: 0,
    };
    this.providers.set(provider.id, provider);
    this.latencyWindows.set(provider.id, []);
    upsertProvider(provider);
    return provider;
  }

  getAll(): Provider[] {
    return [...this.providers.values()];
  }

  get(id: string): Provider | undefined {
    return this.providers.get(id);
  }

  /** Every provider declaring `capability`, eligible or not — the scorer decides eligibility. */
  getCandidates(capability: string): Provider[] {
    const now = Date.now();
    return this.getAll()
      .filter((p) => p.capabilities.includes(capability))
      .map((p) => this.applyCooldown(p, now));
  }

  /** Lazily flips a stale `open` breaker to `half_open`; persists the flip if it happens. */
  private applyCooldown(p: Provider, now: number): Provider {
    const next = withCooldown(p, now);
    if (next.circuitState === p.circuitState) return p;
    const updated = { ...p, ...next };
    this.providers.set(p.id, updated);
    upsertProvider(updated);
    broadcast({ type: 'circuit', data: { providerId: updated.id, circuitState: updated.circuitState } });
    return updated;
  }

  recordSuccess(id: string, latencyMs: number): Provider {
    return this.mutate(id, (p) => {
      const window = this.pushLatency(id, latencyMs);
      return {
        ...p,
        ...onSuccess(p),
        successCount: p.successCount + 1,
        latencyP50Ms: percentile(window, 50),
        latencyP95Ms: percentile(window, 95),
      };
    });
  }

  recordFailure(id: string, now = Date.now()): Provider {
    return this.mutate(id, (p) => ({
      ...p,
      ...onFailure(p, now),
      failureCount: p.failureCount + 1,
    }));
  }

  private mutate(id: string, update: (p: Provider) => Provider): Provider {
    const current = this.providers.get(id);
    if (!current) throw new Error(`Unknown provider "${id}"`);
    const updated = update(current);
    this.providers.set(id, updated);
    upsertProvider(updated);
    if (updated.circuitState !== current.circuitState) {
      broadcast({ type: 'circuit', data: { providerId: updated.id, circuitState: updated.circuitState } });
    }
    return updated;
  }

  private pushLatency(id: string, latencyMs: number): number[] {
    const window = this.latencyWindows.get(id) ?? [];
    window.push(latencyMs);
    if (window.length > LATENCY_WINDOW) window.shift();
    this.latencyWindows.set(id, window);
    return window;
  }

  /** Reserve the single in-flight probe slot for a half-open provider. False if one is already running. */
  tryReserveProbe(id: string): boolean {
    if (this.probing.has(id)) return false;
    this.probing.add(id);
    return true;
  }

  releaseProbe(id: string): void {
    this.probing.delete(id);
  }
}

export const registry = new Registry();
