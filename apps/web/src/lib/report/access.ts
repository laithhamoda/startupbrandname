import type { Gate } from '@sbn/question-bank';
import type { LockReason, ReportKind } from '@sbn/report/model';
import { type Access, reportAccess, type ReportAccess } from '@/lib/entitlements';

/** What the report page builds for an account (D-273). */
export type ReportMode =
  /** Not enough answers: no report, only what is missing. */
  | { readonly access: 'none'; readonly kind: null; readonly lockReason: null }
  /** The one-page summary; the rest is locked until the answers are complete enough. */
  | { readonly access: 'summary'; readonly kind: 'summary'; readonly lockReason: 'completeness' }
  /** The answers are complete, but the account has no full-report entitlement. */
  | {
      readonly access: 'summary_locked';
      readonly kind: 'summary';
      readonly lockReason: 'plan';
    }
  | { readonly access: 'full'; readonly kind: 'full'; readonly lockReason: null };

/**
 * The kind of report and the reason its sections are locked, from the completeness gate and the
 * account's access (D-232, D-245). The server decides; the page only draws what the model holds.
 */
export function reportModeOf(gate: Gate, access: Access): ReportMode {
  const decided: ReportAccess = reportAccess(gate, access);
  switch (decided) {
    case 'none':
      return { access: 'none', kind: null, lockReason: null };
    case 'summary':
      return { access: 'summary', kind: 'summary', lockReason: 'completeness' };
    case 'summary_locked':
      return { access: 'summary_locked', kind: 'summary', lockReason: 'plan' };
    case 'full':
      return { access: 'full', kind: 'full', lockReason: null };
  }
}

/**
 * A full report needs a calculated run. When the run is missing (the answers cannot be calculated,
 * or the engine failed) the page falls back to the summary, and its locked sections point back to
 * the questions (D-273).
 */
export function degradeWithoutRun(
  mode: ReportMode,
  hasRun: boolean,
): { readonly kind: ReportKind; readonly lockReason: LockReason | null } | null {
  if (mode.kind === null) return null;
  if (mode.kind === 'full' && !hasRun) return { kind: 'summary', lockReason: 'completeness' };
  return { kind: mode.kind, lockReason: mode.lockReason };
}
