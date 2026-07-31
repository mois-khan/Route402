import { useMemo, useState } from 'react';
import type { ChaosMode } from '@route402/shared';
import { useStore } from '../lib/store.js';
import { capabilityLabel, circuitStateLabel, circuitStateTone } from '../lib/labels.js';
import { truncateAddress } from '../lib/format.js';
import { StatusDot } from '../components/StatusDot.js';
import { Chip } from '../components/Chip.js';
import { Sparkline, type SparklinePoint } from '../components/Sparkline.js';
import { EmptyState } from '../components/EmptyState.js';

const BUTTONS: { mode: ChaosMode; label: string }[] = [
  { mode: 'offline', label: 'Kill' },
  { mode: 'slow', label: 'Slow' },
  { mode: 'garbage', label: 'Corrupt' },
  { mode: 'healthy', label: 'Restore' },
];

function CopyAddress({ address }: { address: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        void navigator.clipboard.writeText(address);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="text-ink-2 hover:text-ink font-mono text-xs transition-colors"
      title={address}
    >
      {copied ? 'Copied' : truncateAddress(address)}
    </button>
  );
}

/** DESIGN.md §8.2 — one card per provider, full width, stacked, with wallet, jobs, sparkline and inline simulation controls. */
export function Providers() {
  const { providers, calls, sendChaos } = useStore();

  const sparklineByProvider = useMemo(() => {
    const map = new Map<string, SparklinePoint[]>();
    for (const provider of providers) {
      const providerCalls = calls
        .filter((c) => c.providerId === provider.id)
        .slice(0, 20)
        .reverse();
      map.set(
        provider.id,
        providerCalls.map((c) => ({ value: c.latencyMs ?? provider.latencyP50Ms, failed: c.failed }))
      );
    }
    return map;
  }, [calls, providers]);

  if (providers.length === 0) return <EmptyState>No providers registered yet.</EmptyState>;

  return (
    <div className="flex flex-col gap-4">
      {providers.map((p) => {
        const total = p.successCount + p.failureCount;
        const reliability = total > 0 ? p.successCount / total : 1;
        return (
          <div key={p.id} className="rounded-card border-line bg-surface relative overflow-hidden border p-5">
            {p.circuitState === 'open' && (
              <div className="bg-bad/90 text-accent-ink px-3 py-1 text-center text-xs font-medium">
                Paused after {p.consecutiveFailures} failures in a row
              </div>
            )}
            <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 className="text-ink text-lg font-semibold">{p.name}</h3>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {p.capabilities.map((c) => (
                    <Chip key={c}>{capabilityLabel(c)}</Chip>
                  ))}
                </div>
                <div className="text-muted mt-2 text-xs">
                  <CopyAddress address={p.walletAddress} /> · Registered {timeAgo(p.registeredAt)}
                </div>
              </div>
              <StatusDot tone={circuitStateTone(p.circuitState)} label={circuitStateLabel(p.circuitState)} />
            </div>

            <div className="text-ink-2 mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
              <div>
                <div className="text-muted text-xs">Price</div>
                <div className="font-mono">{(p.advertisedPriceMicroUSDC / 1_000_000).toFixed(3)} USDC</div>
              </div>
              <div>
                <div className="text-muted text-xs">Delivered</div>
                <div className="font-mono">{Math.round(reliability * 100)}%</div>
              </div>
              <div>
                <div className="text-muted text-xs">Typical speed</div>
                <div className="font-mono">{p.latencyP50Ms}ms</div>
              </div>
              <div>
                <div className="text-muted text-xs">Slow-day speed</div>
                <div className="font-mono">{p.latencyP95Ms}ms</div>
              </div>
            </div>

            <div className="mt-4">
              <Sparkline points={sparklineByProvider.get(p.id) ?? []} width={400} height={40} />
            </div>

            <div className="border-line-2 bg-bg rounded-card mt-4 border border-dashed p-3">
              <p className="text-faint mb-2 text-xs">Simulation — not part of routing</p>
              <div className="flex flex-wrap gap-2">
                {BUTTONS.map((b) => (
                  <button
                    key={b.mode}
                    onClick={() => void sendChaos(p.id, b.mode)}
                    className="border-line-2 text-ink-2 hover:border-accent-line hover:text-accent rounded-control border px-2.5 py-1 text-xs transition-colors"
                  >
                    {b.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function timeAgo(epochMs: number): string {
  const seconds = Math.max(0, Math.round((Date.now() - epochMs) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  return `${hours}h ago`;
}
