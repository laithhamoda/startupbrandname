import 'server-only';
import { getEarlyAccess, getPreviewEmails } from '@/env/server';
import { type Access, accessFor } from '@/lib/entitlements';
import { launchSpotOf } from '@/lib/launch/spot';
import { projectPlanOf } from '@/lib/payments/account-plan';
import type { SupabaseServerClient } from '@/lib/supabase/server';

/**
 * What the signed-in account may open of a project's report: the project's package (D-320), the
 * preview list (D-245), and the launch window (D-290, D-332): while the launch switch is on, an
 * account that holds an active launch spot opens the full report. The switch alone opens nothing:
 * it is the one place to close the window. One place, so no page can read one of them and forget
 * the others. `previewListValid` is false when the preview list is malformed (the caller logs it).
 */
export async function accountAccess(
  supabase: SupabaseServerClient,
  email: string | null | undefined,
  projectId: string,
  now: Date = new Date(),
): Promise<{ access: Access; previewListValid: boolean }> {
  const preview = getPreviewEmails();
  const holdsSpot = getEarlyAccess() && (await launchSpotOf(supabase)) === 'active';
  const access = accessFor(
    { email, planId: await projectPlanOf(supabase, projectId, now) },
    { previewEmails: preview.emails, earlyAccess: holdsSpot },
  );
  return { access, previewListValid: preview.valid };
}
