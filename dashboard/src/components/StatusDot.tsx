import type { StatusTone } from '../lib/labels.js';

const TONE_CLASS: Record<StatusTone, string> = {
  ok: 'bg-ok',
  warn: 'bg-warn',
  bad: 'bg-bad',
  info: 'bg-info',
  neutral: 'bg-faint',
};

/** DESIGN.md §7 — 8px dot + word. Never one without the other (colour-alone accessibility rule, §11). */
export function StatusDot({ tone, label }: { tone: StatusTone; label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className={`h-2 w-2 shrink-0 rounded-full ${TONE_CLASS[tone]}`} aria-hidden />
      <span className="text-ink-2 text-sm">{label}</span>
    </span>
  );
}
