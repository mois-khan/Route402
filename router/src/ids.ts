import { randomUUID } from 'node:crypto';

/** CLAUDE.md convention — every id is prefixed: prov_, req_, dec_, pay_, call_. */
export function id(prefix: 'req' | 'dec' | 'pay' | 'call'): string {
  return `${prefix}_${randomUUID()}`;
}
