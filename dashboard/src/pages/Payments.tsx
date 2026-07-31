import { useMemo, useState } from 'react';
import { useStore } from '../lib/store.js';
import { PaymentRow } from '../components/PaymentRow.js';
import { EmptyState } from '../components/EmptyState.js';

type Filter = 'all' | 'paid' | 'not_paid';

/** DESIGN.md §8.3 — the full settlement ledger, filterable. One click and the whole screen is evidence for "payment on delivery, not on request". */
export function Payments() {
  const { payments, providers } = useStore();
  const [filter, setFilter] = useState<Filter>('all');

  const filtered = useMemo(() => {
    if (filter === 'paid') return payments.filter((p) => p.status === 'settled');
    if (filter === 'not_paid') return payments.filter((p) => p.status === 'refused' || p.status === 'failed');
    return payments;
  }, [payments, filter]);

  const nameFor = (providerId: string) => providers.find((p) => p.id === providerId)?.name ?? providerId;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        {(['all', 'paid', 'not_paid'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-chip border px-3 py-1 text-sm transition-colors ${
              filter === f ? 'border-accent-line bg-accent-soft text-accent' : 'border-line-2 text-ink-2 hover:text-ink'
            }`}
          >
            {f === 'all' ? 'All' : f === 'paid' ? 'Paid' : 'Not paid'}
          </button>
        ))}
      </div>

      <div className="rounded-card border-line bg-surface border px-4">
        {filtered.length === 0 ? <EmptyState>No payments in this view.</EmptyState> : filtered.map((p) => <PaymentRow key={p.id} payment={p} providerName={nameFor(p.providerId)} />)}
      </div>
    </div>
  );
}
