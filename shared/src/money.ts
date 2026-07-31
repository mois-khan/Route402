/**
 * Micro-USDC helpers.
 *
 * All money in Route402 is an integer count of micro-USDC. Floats never touch
 * a stored value. These helpers exist so that the one place a division happens
 * — display — is written once and is obviously display-only.
 */

export const MICRO_PER_USDC = 1_000_000;

/** Split micro-USDC into whole and fractional parts without floating point. */
export function splitMicroUSDC(micro: number): { whole: number; frac: number } {
  const abs = Math.abs(Math.trunc(micro));
  return { whole: Math.floor(abs / MICRO_PER_USDC), frac: abs % MICRO_PER_USDC };
}

/**
 * Display only. Never feed the result back into a calculation.
 * @example formatMicroUSDC(12000) === "0.012 USDC"
 */
export function formatMicroUSDC(micro: number, opts: { unit?: boolean } = {}): string {
  const sign = micro < 0 ? '-' : '';
  const { whole, frac } = splitMicroUSDC(micro);
  const fracStr = frac.toString().padStart(6, '0').replace(/0+$/, '');
  const num = fracStr ? `${whole}.${fracStr}` : `${whole}`;
  return `${sign}${num}${opts.unit === false ? '' : ' USDC'}`;
}
