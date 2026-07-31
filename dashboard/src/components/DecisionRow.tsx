import { useState } from 'react';
import type { PaymentRecord } from '@route402/shared';
import type { DecisionWithPriority } from '../lib/types.js';
import { capabilityLabel } from '../lib/labels.js';
import { formatTime } from '../lib/format.js';
import { narrate } from '../lib/narrate.js';
import { CandidateTable } from './CandidateTable.js';
import { NarrationPanel } from './NarrationPanel.js';

const ChevronIcon = ({ open }: { open: boolean }) => (
  <svg
    viewBox="0 0 24 24"
    className={`text-faint h-4 w-4 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
    fill="none"
    stroke="currentColor"
    strokeWidth={1.6}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="m6 9 6 6 6-6" />
  </svg>
);

/** DESIGN.md §8.1 — collapsed: time · job · winner · reason (always visible) · chevron. Expanded: CandidateTable + NarrationPanel. */
export function DecisionRow({ decision, payments }: { decision: DecisionWithPriority; payments: PaymentRecord[] }) {
  const [open, setOpen] = useState(false);
  const winner = decision.candidates.find((c) => c.providerId === decision.selectedProviderId);
  const decisionPayments = payments.filter((p) => p.decisionId === decision.id);

  return (
    <div className="border-line border-b last:border-b-0">
      <button onClick={() => setOpen((o) => !o)} className="hover:bg-surface-2 flex w-full items-center gap-4 px-1 py-3 text-left transition-colors">
        <span className="text-faint w-20 shrink-0 font-mono text-xs">{formatTime(decision.timestamp)}</span>
        <span className="text-ink-2 w-36 shrink-0 truncate text-sm">{capabilityLabel(decision.capability)}</span>
        <span className="text-ink w-24 shrink-0 truncate text-sm font-medium">{winner?.providerName ?? '—'}</span>
        <span className="text-ink-2 min-w-0 flex-1 truncate text-sm">{decision.reason}</span>
        <ChevronIcon open={open} />
      </button>

      {open && (
        <div className="bg-surface-2 rounded-card mb-4 flex flex-col gap-4 p-4">
          <CandidateTable candidates={decision.candidates} priority={decision.priority} />
          {decision.fallbackChain.length > 0 && (
            <p className="text-muted text-xs">
              Tried in order:{' '}
              {decision.fallbackChain.map((id) => decision.candidates.find((c) => c.providerId === id)?.providerName ?? id).join(' → ')}
            </p>
          )}
          <NarrationPanel steps={narrate({ decision, payments: decisionPayments })} live={false} />
        </div>
      )}
    </div>
  );
}
