import 'server-only';
import { getEarlyAccess, getPreviewEmails } from '@/env/server';
import { type Access, accessFor } from '@/lib/entitlements';
import { log } from '@/lib/log';
import { bestPlan } from '@/lib/payments/plan-of';
import type { SupabaseServerClient } from '@/lib/supabase/server';

/**
 * The package of the signed-in account: the best one among its subscriptions that cover the
 * account and are running now (D-313), read through row level security. A read that fails counts
 * as the free package and is logged, so a database error never opens a paid report.
 */
async function accountPlan(supabase: SupabaseServerClient, now: Date) {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('plan_id, status, starts_at, ends_at, project_id')
    .is('project_id', null);
  if (error) {
    await log.error('payments.plan_read_failed', { code: error.code });
    return 'free' as const;
  }
  return bestPlan(data, now);
}

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
    { email, planId: await accountPlan(supabase, now) },
    { previewEmails: preview.emails, earlyAccess: getEarlyAccess() },
  );
  return { access, previewListValid: preview.valid };
}
