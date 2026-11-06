import 'server-only';
import { z } from 'zod';
import { log } from '@/lib/log';
import type { SupabaseServerClient } from '@/lib/supabase/server';

/**
 * What an account holds of the launch window (D-332, D-333): `active` opens the full report until
 * the end date, `kept` keeps the project for six months after it, `none` holds nothing.
 */
export type LaunchSpot = 'none' | 'active' | 'kept';

const spotSchema = z.enum(['none', 'active', 'kept']);

/**
 * The signed-in account's spot. A failed read answers `none` and is logged: a spot that cannot be
 * read opens nothing.
 */
export async function launchSpotOf(supabase: SupabaseServerClient): Promise<LaunchSpot> {
  const { data, error } = await supabase.rpc('my_launch_spot');
  if (error) {
    await log.error('launch.spot_read_failed', { code: error.code });
    return 'none';
  }
  const parsed = spotSchema.safeParse(data);
  return parsed.success ? parsed.data : 'none';
}

export interface LaunchWindow {
  readonly spotsTotal: number;
  readonly spotsTaken: number;
  readonly spotsLeft: number;
  /** Null while the end date is missing: the window is closed then. */
  readonly endsAt: Date | null;
  /** Whether a new account may still take a spot. */
  readonly open: boolean;
}

const windowSchema = z
  .array(
    z.object({
      spots_total: z.number().int().nonnegative(),
      spots_taken: z.number().int().nonnegative(),
      spots_left: z.number().int().nonnegative(),
      ends_at: z.string().nullable(),
      open: z.boolean(),
    }),
  )
  .length(1);

/** The window as the counter shows it, or null when it cannot be read (logged). */
export async function loadLaunchWindow(
  supabase: SupabaseServerClient,
): Promise<LaunchWindow | null> {
  const { data, error } = await supabase.rpc('launch_window');
  if (error) {
    await log.error('launch.window_read_failed', { code: error.code });
    return null;
  }
  const parsed = windowSchema.safeParse(data);
  if (!parsed.success) {
    await log.error('launch.window_read_failed', { code: 'shape' });
    return null;
  }
  const [row] = parsed.data;
  if (row === undefined) return null;
  return {
    spotsTotal: row.spots_total,
    spotsTaken: row.spots_taken,
    spotsLeft: row.spots_left,
    endsAt: row.ends_at === null ? null : new Date(row.ends_at),
    open: row.open,
  };
}
