import 'server-only';
import { type NotCalculableReason, suggestChanges, type SuggestedChanges } from '@sbn/engine';
import { completeness, displayPercent, type Language, type StepId } from '@sbn/question-bank';
import { audienceOfAnswers, buildReportModel, type ReportModel } from '@sbn/report/model';
import { analyseProject, pricingOptionsOf, referenceDateOf } from '@/lib/engine/analyse';
import { errorFields, log } from '@/lib/log';
import type { SupabaseServerClient } from '@/lib/supabase/server';
import { degradeWithoutRun, reportModeOf } from './access';
import { accountAccess } from './account-access';
import { loadPackItems } from './pack';

/** How many missing questions the "not enough answers" page lists. */
const MISSING_SHOWN = 5;

/** What the report page draws. */
export type ReportPage =
  /** Below the summary gate: no report, and the questions that would raise the completeness. */
  | { readonly status: 'none'; readonly percent: number; readonly missing: readonly StepId[] }
  /** The model, and a notice when its numbers could not be calculated. */
  | {
      readonly status: 'ready';
      readonly model: ReportModel;
      readonly notice: ReportNotice | null;
    }
  /** The model could not be built at all (logged). */
  | { readonly status: 'failed' };

export type ReportNotice =
  | { readonly kind: 'not_calculable'; readonly reasons: readonly NotCalculableReason[] }
  | { readonly kind: 'failed' };

export interface ReportPageOptions {
  /** The signed-in account's email, for the preview list of D-245. */
  readonly email: string | null;
  readonly locale: Language;
  /** The label after an amount in a currency: the symbol where the site has one, else the code. */
  readonly currencyLabel: (code: string) => string;
  /**
   * Build the one-page summary whatever the account may open. The project page draws the verdict
   * from it and must not pay for a full report and a read of the pack (D-287).
   */
  readonly summaryOnly?: boolean;
  readonly now?: Date;
}

/**
 * Builds what the report page draws, on the server, for one project of the signed-in account
 * (D-273). The access decision is made here from the completeness gate and the account's
 * entitlement (D-232, D-245), and `buildReportModel` is given only the kind it may build, so a
 * locked section's values are never computed. Null when the project is not the account's.
 */
export async function loadReportPage(
  supabase: SupabaseServerClient,
  projectId: string,
  options: ReportPageOptions,
): Promise<ReportPage | null> {
  const now = options.now ?? new Date();
  const analysis = await analyseProject(supabase, projectId, now);
  if (!analysis) return null;
  const { source, outcome } = analysis;
  const score = completeness(source.answers);

  const { access, previewListValid } = accountAccess(options.email);
  if (!previewListValid) await log.warn('report.preview_list_invalid', { projectId });
  const mode = reportModeOf(score.gate, access);
  const run = outcome.status === 'ok' ? outcome.run : null;
  const decided = degradeWithoutRun(mode, run !== null);
  if (decided === null) {
    return {
      status: 'none',
      percent: displayPercent(score.score),
      missing: score.next.slice(0, MISSING_SHOWN),
    };
  }

  // The project page asks for the summary alone: an account that may open the full report gets the
  // summary there, and the verdict is the same word in both kinds (D-287).
  const shown: typeof decided =
    options.summaryOnly === true && decided.kind === 'full'
      ? { kind: 'summary', lockReason: 'completeness' }
      : decided;

  // The search for the changes that would change the verdict runs per request, and only when a
  // page shows it: the full report for a revise or a stop, and the free summary for a stop, which
  // always comes with its three changes (D-273, D-278).
  let changes: SuggestedChanges | null = null;
  const verdict = run?.verdict.verdict.value ?? 'go';
  if (run !== null && (shown.kind === 'full' ? verdict !== 'go' : verdict === 'stop')) {
    try {
      changes = suggestChanges(run, { rules: source.taxRules }, {}, pricingOptionsOf(source));
    } catch (error) {
      await log.error('report.changes_failed', { ...errorFields(error), projectId });
    }
  }
  const packItems =
    shown.kind === 'full'
      ? await loadPackItems(supabase, source.project.countryCode, projectId)
      : [];

  const notCalculable = outcome.status === 'not_calculable' ? outcome.reasons : [];
  try {
    const model = buildReportModel({
      locale: options.locale,
      kind: shown.kind,
      lockReason: shown.lockReason,
      audience: audienceOfAnswers(source.answers),
      project: {
        title: source.project.title,
        countryCode: source.project.countryCode,
        currency: source.project.currency,
        currencyLabel: options.currencyLabel(source.project.currency),
      },
      answers: source.answers,
      provenance: source.provenance,
      run,
      notCalculable,
      changes,
      packItems,
      completeness: { percent: displayPercent(score.score), gate: score.gate },
      today: referenceDateOf(now),
      inputHash: analysis.inputHash,
    });
    const notice: ReportNotice | null =
      outcome.status === 'not_calculable'
        ? { kind: 'not_calculable', reasons: outcome.reasons }
        : outcome.status === 'failed'
          ? { kind: 'failed' }
          : null;
    return { status: 'ready', model, notice };
  } catch (error) {
    await log.error('report.model_failed', { ...errorFields(error), projectId });
    return { status: 'failed' };
  }
}
