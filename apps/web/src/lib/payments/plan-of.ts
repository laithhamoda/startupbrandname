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

function best(
  rows: readonly SubscriptionRow[],
  now: Date,
  counts: (row: SubscriptionRow) => boolean,
) {
  let plan: PlanId = 'free';
  for (const row of rows) {
    if (!counts(row) || !isPlanId(row.plan_id) || !isRunning(row, now)) continue;
    if (PLAN_ORDER.indexOf(row.plan_id) > PLAN_ORDER.indexOf(plan)) plan = row.plan_id;
  }
  return plan;
}

/** The best package among the running subscriptions that cover the account; free without one. */
export function bestPlan(rows: readonly SubscriptionRow[], now: Date): PlanId {
  return best(rows, now, (row) => row.project_id === null);
}

/**
 * The package of one project (D-320): the best running purchase for that project, or a running
 * package that covers the account, such as a course voucher (D-319); free without one.
 */
export function projectPlan(
  rows: readonly SubscriptionRow[],
  projectId: string,
  now: Date,
): PlanId {
  return best(rows, now, (row) => row.project_id === null || row.project_id === projectId);
}
