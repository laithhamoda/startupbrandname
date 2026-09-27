import { createHash } from 'node:crypto';

/** JSON with object keys sorted at every level, so key order never changes the hash. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, inner]) => inner !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([key, inner]) => `${JSON.stringify(key)}:${canonical(inner)}`);
    return `{${entries.join(',')}}`;
  }
  return value === undefined ? 'null' : JSON.stringify(value);
}

/**
 * The input hash stored with every tool run (CLAUDE.md rule 4): the same inputs reuse the stored
 * output instead of calling the model again.
 */
export function inputHash(parts: unknown): string {
  return createHash('sha256').update(canonical(parts)).digest('hex');
}
