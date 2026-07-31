import type { Provider } from '@route402/shared';
import { formatMicroUSDC } from '@route402/shared';
import { circuitStateLabel, circuitStateTone, capabilityLabel } from '../lib/labels.js';
import { formatMs, formatPercent } from '../lib/format.js';
import { StatusDot } from './StatusDot.js';
import { Sparkline, type SparklinePoint } from './Sparkline.js';

/** DESIGN.md §7 — name · job · price · status · typical/slow speed · delivered % · earned · sparkline. */
export function ProviderCard({
  provider,
  earnedMicroUSDC,
  sparklinePoints,
}: {
  provider: Provider;
  earnedMicroUSDC: number;
  sparklinePoints: SparklinePoint[];
}) {
  const total = provider.successCount + provider.failureCount;
  const reliability = total > 0 ? provider.successCount / total : 1;
  const paused = provider.circuitState === 'open';

  return (
    <div className="rounded-card border-line bg-surface relative flex flex-col gap-3 overflow-hidden border p-5">
      {paused && (
        <div className="bg-bad/90 text-accent-ink absolute inset-x-0 top-0 px-3 py-1 text-center text-xs font-medium">
          Paused after {provider.consecutiveFailures} failures in a row
        </div>
      )}
      <div className={paused ? 'mt-5' : ''}>
        <h3 className="text-ink text-base font-semibold">{provider.name}</h3>
        <p className="text-muted text-xs">{provider.capabilities.map(capabilityLabel).join(', ')}</p>
      </div>

      <StatusDot tone={circuitStateTone(provider.circuitState)} label={circuitStateLabel(provider.circuitState)} />

      <div className="text-ink font-mono text-lg">
        {formatMicroUSDC(provider.advertisedPriceMicroUSDC)}
        <span className="text-muted ml-1 text-sm font-sans">/ call</span>
      </div>

      <div className="text-ink-2 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <div>
          <div className="text-muted text-xs">Typical speed</div>
          <div className="font-mono">{formatMs(provider.latencyP50Ms)}</div>
        </div>
        <div>
          <div className="text-muted text-xs">Slow-day speed</div>
          <div className="font-mono">{formatMs(provider.latencyP95Ms)}</div>
        </div>
        <div>
          <div className="text-muted text-xs">Delivered</div>
          <div className="font-mono">{formatPercent(reliability)}</div>
        </div>
        <div>
          <div className="text-muted text-xs">Earned</div>
          <div className="font-mono">{formatMicroUSDC(earnedMicroUSDC)}</div>
        </div>
      </div>

      <Sparkline points={sparklinePoints} />
    </div>
  );
}
