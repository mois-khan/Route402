/**
 * Prefixed id generation. Every id in Route402 carries its type as a prefix
 * so that a raw id in a log line or on the dashboard is self-describing.
 */

export type IdPrefix = 'prov' | 'req' | 'dec' | 'pay' | 'call';

/**
 * Time-ordered, collision-resistant enough for a single-process demo.
 * Sorts lexicographically by creation time, which makes "newest first"
 * queries on the ledger trivial.
 */
export function newId(prefix: IdPrefix): string {
  const time = Date.now().toString(36).padStart(9, '0');
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${time}${rand}`;
}
