import type { ReactNode } from 'react';

/** DESIGN.md §7 — label · value · optional sub-line · optional sparkline slot. */
export function StatTile({ label, value, sub, children }: { label: string; value: ReactNode; sub?: ReactNode; children?: ReactNode }) {
  return (
    <div className="rounded-card border-line bg-surface flex flex-col gap-2 border p-5">
      <div className="text-muted text-xs font-medium tracking-wider uppercase">{label}</div>
      <div className="text-ink font-mono text-2xl">{value}</div>
      {sub && <div className="text-muted text-sm">{sub}</div>}
      {children}
    </div>
  );
}
