import type { ConnectionState } from '../lib/ws.js';

const CONFIG: Record<ConnectionState, { label: string; tone: 'ok' | 'warn' | 'bad' }> = {
  connecting: { label: 'Connecting…', tone: 'warn' },
  connected: { label: 'TestNet', tone: 'ok' },
  reconnecting: { label: 'Reconnecting…', tone: 'warn' },
  unreachable: { label: 'Router unreachable', tone: 'bad' },
};

const DOT_CLASS = { ok: 'bg-ok', warn: 'bg-warn', bad: 'bg-bad' };

/** DESIGN.md §7 — network name + dot, right end of the nav. */
export function ConnectionPill({ state }: { state: ConnectionState }) {
  const cfg = CONFIG[state];
  return (
    <span className="text-ink-2 inline-flex items-center gap-2 text-sm">
      <span className={`h-2 w-2 rounded-full ${DOT_CLASS[cfg.tone]}`} aria-hidden />
      {cfg.label}
    </span>
  );
}
