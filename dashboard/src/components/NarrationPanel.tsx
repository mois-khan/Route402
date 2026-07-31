import { useEffect, useState } from 'react';
import type { Step } from '../lib/narrate.js';
import { IDLE_SENTENCE } from '../lib/narrate.js';
import { formatMs } from '../lib/format.js';

type DotState = 'pending' | 'active' | 'done' | 'failed';

function Dot({ state }: { state: DotState }) {
  if (state === 'pending') return <span className="border-faint h-2.5 w-2.5 rounded-full border" />;
  if (state === 'failed') return <span className="bg-bad h-2.5 w-2.5 rounded-full" />;
  if (state === 'active') return <span className="bg-accent animate-pulse-dot h-2.5 w-2.5 rounded-full" />;
  return <span className="bg-accent h-2.5 w-2.5 rounded-full" />;
}

const STEP_DWELL_MS = 350;

/**
 * DESIGN.md §3 — the centrepiece. `live=true` reveals steps one at a time
 * with a minimum dwell so a 3ms decision is still readable; `live=false`
 * (an expanded decision row replaying history) renders everything at once.
 * The elapsed time shown is always the real measured value — the pacing is
 * a reading aid, never a rewrite of the number (§3.4).
 */
export function NarrationPanel({ steps, live, requestId }: { steps: Step[]; live: boolean; requestId?: string }) {
  const [revealed, setRevealed] = useState(live ? 0 : steps.length);

  useEffect(() => {
    if (!live) {
      setRevealed(steps.length);
      return;
    }
    setRevealed(0);
    if (steps.length === 0) return;
    let cancelled = false;
    let i = 0;
    const advance = () => {
      if (cancelled) return;
      i += 1;
      setRevealed(i);
      if (i < steps.length) timer = setTimeout(advance, STEP_DWELL_MS);
    };
    let timer = setTimeout(advance, STEP_DWELL_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [steps, live]);

  return (
    <div className="rounded-card border-line bg-surface border p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-ink text-lg font-semibold">Right now</h2>
        {requestId && <span className="text-faint font-mono text-xs">{requestId}</span>}
      </div>

      {steps.length === 0 ? (
        <p className="text-muted text-base">{IDLE_SENTENCE}</p>
      ) : (
        <ol>
          {steps.map((step, i) => {
            const shown = i < revealed;
            const isLastShown = i === revealed - 1;
            const state: DotState = !shown ? 'pending' : step.failed ? 'failed' : isLastShown && revealed < steps.length ? 'active' : 'done';

            return (
              <li key={i} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <Dot state={state} />
                  {i < steps.length - 1 && <div className={`w-px flex-1 ${shown ? 'bg-accent-line' : 'bg-line'}`} />}
                </div>
                <div className="flex-1 pb-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className={`text-sm font-semibold ${state === 'pending' ? 'text-faint' : 'text-ink'}`}>{step.label}</span>
                    {shown && step.elapsedMs !== undefined && <span className="text-faint font-mono text-xs">{formatMs(step.elapsedMs)}</span>}
                  </div>
                  {shown && <p className={`text-base ${step.failed ? 'text-bad' : 'text-ink-2'}`}>{step.sentence}</p>}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
