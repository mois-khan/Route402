import type { ScoredCandidate, Priority } from '@route402/shared';
import { formatMicroUSDC } from '@route402/shared';
import { ineligibleReasonLabel, weightsChipLabel } from '../lib/labels.js';
import { formatMs, formatPercent } from '../lib/format.js';
import { Chip } from './Chip.js';

/**
 * DESIGN.md §8.1 / §4.5 — options table. Winner row washed accent + `Best`
 * chip. Rejected rows stay in the table, faint, with their reason directly
 * beneath (hard rule 6 — never removed, never collapsed behind a toggle).
 * Score is shown raw, never rescaled — a judge may read scorer.ts on stage.
 */
export function CandidateTable({ candidates, priority }: { candidates: ScoredCandidate[]; priority: Priority | undefined }) {
  const sorted = [...candidates].sort((a, b) => a.compositeScore - b.compositeScore);
  const winnerId = sorted.find((c) => c.eligible)?.providerId;

  return (
    <div>
      <div className="mb-3">
        <Chip>{weightsChipLabel(priority)}</Chip>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] text-sm">
          <thead>
            <tr className="text-muted border-line border-b text-left text-xs tracking-wider uppercase">
              <th className="pb-2 font-medium">Option</th>
              <th className="pb-2 font-medium">Price</th>
              <th className="pb-2 font-medium">Speed</th>
              <th className="pb-2 font-medium">Delivered</th>
              <th className="pb-2 font-medium">Score</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((c) => {
              const isWinner = c.providerId === winnerId;
              return (
                <tr key={c.providerId} className={isWinner ? 'bg-accent-soft' : !c.eligible ? 'text-faint' : 'text-ink-2'}>
                  <td className="py-2 pr-3">
                    <div className="flex items-center gap-2">
                      <span className={isWinner ? 'text-ink font-medium' : ''}>{c.providerName}</span>
                      {isWinner && <Chip variant="accent">Best</Chip>}
                    </div>
                    {!c.eligible && <div className="text-bad text-xs">{ineligibleReasonLabel(c.ineligibleReason)}</div>}
                  </td>
                  <td className="py-2 pr-3 font-mono">{formatMicroUSDC(c.priceMicroUSDC)}</td>
                  <td className="py-2 pr-3 font-mono">{formatMs(c.expectedLatencyMs)}</td>
                  <td className="py-2 pr-3 font-mono">{formatPercent(c.reliabilityScore)}</td>
                  <td className="py-2 font-mono">{c.eligible ? c.compositeScore.toFixed(3) : 'Not considered'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-muted mt-3 text-xs">
        Lower score wins. It blends price, speed and how often the provider delivers — weighted by what the request asked for.
      </p>
    </div>
  );
}
