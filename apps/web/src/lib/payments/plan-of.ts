import { PLAN_ORDER, PLANS, type PlanId } from '@/config/plans';

/** A subscription row as the account reads it (migration 20261025120000_m7_payments.sql). */
export interface SubscriptionRow {
  readonly plan_id: string;
  readonly status: string;
  readonly starts_at: string;
  readonly ends_at: string | null;
  readonly project_id: string | null;
}

function isPlanId(value: string): value is PlanId {
  return Object.hasOwn(PLANS, value);
}

/**
 * Whether a subscription gives access at `now`: started, not ended, and not ended early by a
 * refund or chargeback (status 'ended'). A cancelled one runs to its end date; a past-due renewal
 * keeps access while the provider retries.
 */
export function isRunning(row: SubscriptionRow, now: Date): boolean {
  if (row.status === 'ended') return false;
  const start = Date.parse(row.starts_at);
  if (Number.isNaN(start) || start > now.getTime()) return false;
  if (row.ends_at === null) return row.status !== 'canceled';
  const end = Date.parse(row.ends_at);
  return !Number.isNaN(end) && end > now.getTime();
}

/** The best package among the running subscriptions that cover the account; free without one. */
export function bestPlan(rows: readonly SubscriptionRow[], now: Date): PlanId {
  let best: PlanId = 'free';
  for (const row of rows) {
    if (row.project_id !== null || !isPlanId(row.plan_id) || !isRunning(row, now)) continue;
    if (PLAN_ORDER.indexOf(row.plan_id) > PLAN_ORDER.indexOf(best)) best = row.plan_id;
  }
  return best;
}
