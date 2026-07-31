/** DESIGN.md §4.4 — numbers always carry units, money and ids are always mono. */

// formatMicroUSDC is shared/src/money.ts's, not redefined — the router and
// the dashboard must never format the same number two different ways.
export { formatMicroUSDC } from '@route402/shared';

export function formatMs(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function formatTime(epochMs: number): string {
  return new Date(epochMs).toLocaleTimeString(undefined, { hour12: false });
}

export function formatPercent(n: number): string {
  return `${Math.round(n * 100)}%`;
}

export function truncateAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

export function truncateHash(hash: string): string {
  if (hash.length <= 14) return hash;
  return `${hash.slice(0, 8)}…${hash.slice(-6)}`;
}
