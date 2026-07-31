import { useEffect, useRef, useState } from 'react';
import { formatMicroUSDC } from '@route402/shared';

/**
 * DESIGN.md §7 / §6.4 — the `Saved` tile. 56px value, savedPercent beneath
 * in accent, baseline comparison in muted. The one animated counter in the
 * app (counts to its new value over 240ms) — everything else renders the
 * real number immediately.
 */
export function HeroStat({ savedMicroUSDC, savedPercent }: { savedMicroUSDC: number; savedPercent: number }) {
  const [display, setDisplay] = useState(savedMicroUSDC);
  const prev = useRef(savedMicroUSDC);
  const reduceMotion = useRef(typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  useEffect(() => {
    if (reduceMotion.current) {
      setDisplay(savedMicroUSDC);
      prev.current = savedMicroUSDC;
      return;
    }
    const from = prev.current;
    const to = savedMicroUSDC;
    const start = performance.now();
    const duration = 240;
    let raf: number;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      setDisplay(Math.round(from + (to - from) * t));
      if (t < 1) raf = requestAnimationFrame(tick);
      else prev.current = to;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [savedMicroUSDC]);

  return (
    <div className="rounded-card border-line bg-surface col-span-2 flex flex-col gap-2 border p-5">
      <div className="text-muted text-xs font-medium tracking-wider uppercase">Saved</div>
      <div className="text-ink font-sans text-5xl font-semibold tracking-tight tabular-nums">{formatMicroUSDC(display)}</div>
      <div className="text-accent text-sm font-medium">{savedPercent}% cheaper</div>
      <div className="text-muted text-sm">vs. always using the priciest provider</div>
    </div>
  );
}
