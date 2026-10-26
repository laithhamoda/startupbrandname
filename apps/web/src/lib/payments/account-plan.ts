import 'server-only';
import type { PlanId } from '@/config/plans';
import { log } from '@/lib/log';
import type { SupabaseServerClient } from '@/lib/supabase/server';
import { bestPlan, projectPlan, type SubscriptionRow } from './plan-of';

/**
 * The signed-in account's subscriptions, read through row level security. A read that fails gives
 * none and is logged, so a database error never opens a paid package.
 */
export async function subscriptionsOf(
  supabase: SupabaseServerClient,
): Promise<readonly SubscriptionRow[]> {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('plan_id, status, starts_at, ends_at, project_id');
  if (error) {
    await log.error('payments.plan_read_failed', { code: error.code });
    return [];
  }
  return data;
}

/** The package that covers the whole account, such as a course voucher (D-315, D-319). */
export async function accountPlanOf(
  supabase: SupabaseServerClient,
  now: Date = new Date(),
): Promise<PlanId> {
  return bestPlan(await subscriptionsOf(supabase), now);
}

/** The package of one project of the account (D-320). */
export async function projectPlanOf(
  supabase: SupabaseServerClient,
  projectId: string,
  now: Date = new Date(),
): Promise<PlanId> {
  return projectPlan(await subscriptionsOf(supabase), projectId, now);
}
