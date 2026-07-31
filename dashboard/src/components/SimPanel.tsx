import type { ChaosMode, Provider } from '@route402/shared';

const BUTTONS: { mode: ChaosMode; label: string }[] = [
  { mode: 'offline', label: 'Kill' },
  { mode: 'slow', label: 'Slow' },
  { mode: 'garbage', label: 'Corrupt' },
  { mode: 'healthy', label: 'Restore' },
];

/**
 * DESIGN.md §7 / §8.5 — the only human-triggered surface in the product
 * (CLAUDE.md rule 8). Dashed border, `--bg` fill so it reads as sitting
 * behind the product, ghost buttons, never mistaken for routing logic.
 */
export function SimPanel({
  providers,
  onChaos,
  onSendLoad,
}: {
  providers: Provider[];
  onChaos: (providerId: string, mode: ChaosMode) => void;
  onSendLoad: (count: number) => void;
}) {
  return (
    <div className="rounded-card border-line-2 bg-bg border border-dashed p-5">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-ink-2 text-sm font-semibold">Simulation — not part of routing</h2>
        <button
          onClick={() => onSendLoad(20)}
          className="border-line-2 text-ink-2 hover:border-accent-line hover:text-accent rounded-control border px-3 py-1.5 text-sm transition-colors"
        >
          Send 20 requests
        </button>
      </div>
      <p className="text-faint mb-4 text-xs">These buttons pretend a provider went down. Routing decisions are never made here.</p>
      <div className="flex flex-col gap-2">
        {providers.map((p) => (
          <div key={p.id} className="flex flex-wrap items-center gap-2">
            <span className="text-ink-2 w-32 shrink-0 text-sm">{p.name}</span>
            {BUTTONS.map((b) => (
              <button
                key={b.mode}
                onClick={() => onChaos(p.id, b.mode)}
                className="border-line-2 text-ink-2 hover:border-accent-line hover:text-accent rounded-control border px-2.5 py-1 text-xs transition-colors"
              >
                {b.label}
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
