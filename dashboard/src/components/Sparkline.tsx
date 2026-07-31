export interface SparklinePoint {
  value: number;
  failed?: boolean;
}

/**
 * DESIGN.md §9.1 — last 20 calls, single de-emphasised line, last point an
 * accent dot, failures as bad dots with a surface ring. No axes, no
 * gridlines, no legend — the card title names the series.
 */
export function Sparkline({ points, width = 160, height = 32 }: { points: SparklinePoint[]; width?: number; height?: number }) {
  if (points.length === 0) return <svg width={width} height={height} role="img" aria-label="No calls yet" />;

  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const stepX = points.length > 1 ? width / (points.length - 1) : 0;
  const y = (v: number) => height - 4 - ((v - min) / range) * (height - 8);
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${(i * stepX).toFixed(1)} ${y(p.value).toFixed(1)}`).join(' ');

  return (
    <svg width={width} height={height} className="overflow-visible" role="img" aria-label="Latency, last 20 calls">
      <path d={path} fill="none" stroke="var(--color-spark)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p, i) => {
        const isLast = i === points.length - 1;
        if (!p.failed && !isLast) return null;
        return (
          <circle
            key={i}
            cx={i * stepX}
            cy={y(p.value)}
            r={4}
            fill={p.failed ? 'var(--color-bad)' : 'var(--color-accent)'}
            stroke="var(--color-surface)"
            strokeWidth={2}
          />
        );
      })}
    </svg>
  );
}
