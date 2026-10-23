import 'server-only';
import type { NotCalculableReason } from '@sbn/engine';
import type { Gate } from '@sbn/question-bank';
import type { Section } from '@sbn/report/model';
import { unstable_rethrow } from 'next/navigation';
import { errorFields, log } from '@/lib/log';
import type { SupabaseServerClient } from '@/lib/supabase/server';
import { loadReportPage, type ReportPageOptions } from './load';

/** What the result region of the project page draws (D-286). */
export type ProjectResultState =
  /** Below the summary gate: there is no result to show yet. */
  | { readonly status: 'none' }
  /** The verdict section of the one-page summary: the word, and for a stop its three changes. */
  | { readonly status: 'verdict'; readonly section: Section }
  /** The answers are enough but the numbers cannot be calculated: what to answer or correct. */
  | { readonly status: 'needs_answers'; readonly reasons: readonly NotCalculableReason[] }
  /** Nothing could be built (logged). The rest of the project page stands. */
  | { readonly status: 'failed' };

export interface ProjectResultOptions extends Omit<ReportPageOptions, 'summaryOnly'> {
  /** The completeness gate the page already knows: below the summary there is nothing to load. */
  readonly gate: Gate;
}

/**
 * The check result for the project page (D-286). It is the first section of the one-page summary,
 * built by the report loader, so the page shows the same verdict word, and for a stop the same
 * three changes, as the report: one source, no second reading of the answers. Below the summary
 * gate it reads nothing and runs nothing. It never throws except with Next.js's own signals: a
 * failure is logged and the page goes on without a result.
 */
export async function loadProjectResult(
  supabase: SupabaseServerClient,
  projectId: string,
  options: ProjectResultOptions,
): Promise<ProjectResultState> {
  const { gate, ...pageOptions } = options;
  if (gate === 'none') return { status: 'none' };
  try {
    const page = await loadReportPage(supabase, projectId, { ...pageOptions, summaryOnly: true });
    if (page === null) {
      // The page loaded this project a moment ago: a read that comes back empty leaves a trace.
      await log.warn('project.result_missing', { projectId });
      return { status: 'failed' };
    }
    if (page.status === 'failed') return { status: 'failed' };
    if (page.status === 'none') return { status: 'none' };
    const verdict = page.model.sections.find((section) => section.id === 'verdict');
    if (verdict !== undefined && !verdict.locked) return { status: 'verdict', section: verdict };
    if (page.notice?.kind === 'not_calculable') {
      return { status: 'needs_answers', reasons: page.notice.reasons };
    }
    return { status: 'failed' };
  } catch (error) {
    // Next.js's own signals (a dynamic API, a redirect) must pass through.
    unstable_rethrow(error);
    await log.error('project.result_failed', { ...errorFields(error), projectId });
    return { status: 'failed' };
  }
}
