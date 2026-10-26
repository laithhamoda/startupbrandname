import type { Gate } from '@sbn/question-bank';
import { PLANS, type Entitlements, type PlanId } from '@/config/plans';

/**
 * What an account may open (CLAUDE.md §3, D-232). The entitlements are read from the plan table in
 * `config/plans.ts`, and no code here branches on a plan name. Until payments exist (M7) nobody has
 * a plan, so every account is `free`.
 */

export interface AccessSubject {
  /** The signed-in account's email, as Supabase Auth reports it (the sign-in proves the owner). */
  readonly email: string | null | undefined;
  /** The account's plan; null or missing means `free`, which is every account until M7. */
  readonly planId?: PlanId | null;
}

export interface AccessOptions {
  /** `FULL_REPORT_PREVIEW_EMAILS` (D-245): the addresses that see the full report before M7. */
  readonly previewEmails: readonly string[];
  /**
   * `EARLY_ACCESS_FULL_REPORT` (D-290): while it is on, every account opens the full report without
   * the plan, as an address on the preview list does. Off when missing.
   */
  readonly earlyAccess?: boolean;
}

export interface Access {
  readonly planId: PlanId;
  readonly entitlements: Entitlements;
  /**
   * True for an address on the preview allow-list, and for every account during early access: the
   * full report opens without the plan.
   */
  readonly fullReportPreview: boolean;
}

/** What a report page shows, from the completeness gate and the account's access. */
export type ReportAccess = 'none' | 'summary' | 'summary_locked' | 'numbers' | 'full';

/**
 * The plan of the account and its entitlements, and whether the account is on the preview list.
 * The comparison ignores case and surrounding spaces on both sides.
 */
export function accessFor(subject: AccessSubject, options: AccessOptions): Access {
  const planId = subject.planId ?? 'free';
  const email = subject.email?.trim().toLowerCase() ?? '';
  const listed =
    email !== '' && options.previewEmails.some((entry) => entry.trim().toLowerCase() === email);
  const fullReportPreview = options.earlyAccess === true || listed;
  return { planId, entitlements: PLANS[planId].entitlements, fullReportPreview };
}

/** Whether the package opens the full report. */
export function includesFullReport(access: Access): boolean {
  return access.entitlements.report === 'full';
}

/** Whether the package opens at least the «استراتيجي» numbers report (D-314). */
export function includesStandardReport(access: Access): boolean {
  return access.entitlements.report !== 'summary';
}

/**
 * How much of the report the account may see (D-232, D-316). The gate comes from the completeness
 * of the answers (`@sbn/question-bank`): `none` shows nothing, `summary` the one-page summary,
 * `numbers` the «استراتيجي» numbers report (gate `standard`), `full` the whole report. Each paid report needs both its
 * gate and the package: at a higher gate a package gets the most it includes, and an account with
 * neither the package nor the preview list gets the summary with its locked sections,
 * `summary_locked`. The preview list and early access stand for the full package. The server
 * decides this: a locked section's values must never reach the page (D-232).
 */
export function reportAccess(gate: Gate, access: Access): ReportAccess {
  if (gate === 'none') return 'none';
  if (gate === 'summary') return 'summary';
  const full = includesFullReport(access) || access.fullReportPreview;
  if (gate === 'full' && full) return 'full';
  if (full || includesStandardReport(access)) return 'numbers';
  return 'summary_locked';
}
