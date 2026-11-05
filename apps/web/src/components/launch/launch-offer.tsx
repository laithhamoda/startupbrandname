import { getEarlyAccess } from '@/env/server';
import { claimLaunchSpot } from '@/lib/launch/actions';
import { launchSpotOf, loadLaunchWindow } from '@/lib/launch/spot';
import type { SupabaseServerClient } from '@/lib/supabase/server';
import { LaunchSpotCard } from './launch-spot-card';

/**
 * The launch spot offer for the signed-in account, or nothing: while the launch switch is off, or
 * when the account already holds a spot, there is nothing to offer. A window that has ended says
 * so to an account without a spot.
 */
export async function LaunchOffer({
  supabase,
  locale,
}: {
  supabase: SupabaseServerClient;
  locale: string;
}) {
  if (!getEarlyAccess()) return null;
  const [spot, window] = await Promise.all([launchSpotOf(supabase), loadLaunchWindow(supabase)]);
  if (spot !== 'none' || window === null) return null;
  return (
    <LaunchSpotCard
      open={window.open}
      spotsLeft={window.spotsLeft}
      spotsTotal={window.spotsTotal}
      claim={claimLaunchSpot.bind(null, locale)}
    />
  );
}
