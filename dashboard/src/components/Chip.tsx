import type { ReactNode } from 'react';

type ChipVariant = 'neutral' | 'accent' | 'warn' | 'bad' | 'info';

const VARIANT_CLASS: Record<ChipVariant, string> = {
  neutral: 'border-line-2 text-ink-2 bg-surface-2',
  accent: 'border-accent-line text-accent bg-accent-soft',
  warn: 'border-warn/30 text-warn bg-warn/10',
  bad: 'border-bad/30 text-bad bg-bad/10',
  info: 'border-info/30 text-info bg-info/10',
};

/** DESIGN.md §7 — 4px radius, 12px text, 2px/8px padding. */
export function Chip({ variant = 'neutral', children }: { variant?: ChipVariant; children: ReactNode }) {
  return (
    <span className={`rounded-chip inline-flex items-center border px-2 py-0.5 text-xs whitespace-nowrap ${VARIANT_CLASS[variant]}`}>
      {children}
    </span>
  );
}
