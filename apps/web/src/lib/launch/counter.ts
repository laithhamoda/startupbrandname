/**
 * What the public counter reads from /api/launch/window (D-331): real numbers only, from the
 * database. The client never shows a number it did not receive.
 */
export interface CounterData {
  readonly open: boolean;
  readonly spotsLeft: number;
  readonly spotsTotal: number;
  /** ISO time, or null while the end date is missing (the window is closed then). */
  readonly endsAt: string | null;
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

/**
 * The counter data in an answer, or null when it is not the answer of the route. Written by hand,
 * not with zod: this runs in the browser, and the library's weight would reach every page.
 */
export function parseCounter(body: unknown): CounterData | null {
  if (typeof body !== 'object' || body === null) return null;
  const { open, spotsLeft, spotsTotal, endsAt } = body as Record<string, unknown>;
  if (typeof open !== 'boolean' || !isCount(spotsLeft) || !isCount(spotsTotal)) return null;
  if (endsAt !== null && typeof endsAt !== 'string') return null;
  return { open, spotsLeft, spotsTotal, endsAt };
}

const DAY_MS = 86_400_000;

/**
 * Whole days left until the end date, counting a started day as a day; 0 once it has passed. Null
 * when there is no date. Computed in the browser from the end date, so a cached answer does not
 * freeze the day count.
 */
export function daysLeft(endsAt: string | null, now: number): number | null {
  if (endsAt === null) return null;
  const end = Date.parse(endsAt);
  if (Number.isNaN(end)) return null;
  return Math.max(0, Math.ceil((end - now) / DAY_MS));
}
