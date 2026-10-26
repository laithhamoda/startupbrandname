import 'server-only';
import type { PlanId } from '@/config/plans';
import { log } from '@/lib/log';
import type { SupabaseServerClient } from '@/lib/supabase/server';
import { bestPlan } from './plan-of';

/**
 * The package of the signed-in account: the best one among its subscriptions that cover the
 * account and are running now (D-313, D-315), read through row level security. A read that fails
 * counts as the free package and is logged, so a database error never opens a paid report.
 */
export async function accountPlanOf(
  supabase: SupabaseServerClient,
  now: Date = new Date(),
): Promise<PlanId> {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('plan_id, status, starts_at, ends_at, project_id')
    .is('project_id', null);
  if (error) {
    await log.error('payments.plan_read_failed', { code: error.code });
    return 'free';
  }
  return bestPlan(data, now);
}
