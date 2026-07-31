import type { PaymentWithCreatedAt } from '../lib/types.js';
import { formatMicroUSDC } from '@route402/shared';
import { paymentStatusLabel, paymentStatusTone } from '../lib/labels.js';
import { formatMs, formatTime, truncateHash } from '../lib/format.js';
import { StatusDot } from './StatusDot.js';
import { Chip } from './Chip.js';

/** DESIGN.md §7 / §8.3 — time · provider · amount · status · settled-in · badges · receipt link. */
export function PaymentRow({ payment, providerName }: { payment: PaymentWithCreatedAt; providerName: string }) {
  const receiptTxId = payment.txIds[0];

  return (
    <div className="border-line flex flex-wrap items-center gap-4 border-b px-1 py-3 text-sm last:border-b-0">
      {/* settledAt is real settlement time when paid; createdAt (the row's real insert time, not "now") covers failed/refused attempts, which never get a settledAt. */}
      <span className="text-faint w-20 shrink-0 font-mono text-xs">{formatTime(payment.settledAt ?? payment.createdAt)}</span>
      <span className="text-ink-2 w-24 shrink-0">{providerName}</span>
      <span className="text-ink w-28 shrink-0 font-mono">{formatMicroUSDC(payment.amountMicroUSDC)}</span>
      <span className="w-32 shrink-0">
        <StatusDot tone={paymentStatusTone(payment.status)} label={paymentStatusLabel(payment.status)} />
      </span>
      <span className="text-ink-2 w-16 shrink-0 font-mono text-xs">{payment.finalityMs ? formatMs(payment.finalityMs) : '—'}</span>
      <span className="flex shrink-0 gap-1.5">
        {payment.feeSponsored && <Chip variant="info">Fee covered</Chip>}
        {payment.groupId && <Chip variant="info">Paid together</Chip>}
      </span>
      <span className="ml-auto shrink-0">
        {payment.explorerUrl ? (
          <a href={payment.explorerUrl} target="_blank" rel="noreferrer" className="text-accent text-sm hover:underline">
            View ↗
          </a>
        ) : (
          <span className="text-faint text-sm">—</span>
        )}
      </span>
      {receiptTxId && <span className="text-faint w-full font-mono text-xs">{truncateHash(receiptTxId)}</span>}
    </div>
  );
}
