import { z } from 'zod';

/**
 * What the public counter reads from /api/launch/window (D-331): real numbers only, from the
 * database. The client never shows a number it did not receive.
 */
export const counterSchema = z.object({
  open: z.boolean(),
  spotsLeft: z.number().int().nonnegative(),
  spotsTotal: z.number().int().nonnegative(),
  /** ISO time, or null while the end date is missing (the window is closed then). */
  endsAt: z.string().nullable(),
});

export type CounterData = z.infer<typeof counterSchema>;

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
