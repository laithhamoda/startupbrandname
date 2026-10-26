import 'server-only';
import { getEarlyAccess, getPreviewEmails } from '@/env/server';
import { type Access, accessFor } from '@/lib/entitlements';
import { accountPlanOf } from '@/lib/payments/account-plan';
import type { SupabaseServerClient } from '@/lib/supabase/server';

/**
 * What the signed-in account may open of the report: its package, and the two temporary switches
 * that stood in for packages before M7, the preview list (D-245) and early access (D-290). One
 * place, so no page can read one of them and forget the others. `previewListValid` is false when
 * the preview list is malformed (the caller logs it).
 */
export async function accountAccess(
  supabase: SupabaseServerClient,
  email: string | null | undefined,
  now: Date = new Date(),
): Promise<{ access: Access; previewListValid: boolean }> {
  const preview = getPreviewEmails();
  const access = accessFor(
    { email, planId: await accountPlanOf(supabase, now) },
    { previewEmails: preview.emails, earlyAccess: getEarlyAccess() },
  );
  return { access, previewListValid: preview.valid };
}
