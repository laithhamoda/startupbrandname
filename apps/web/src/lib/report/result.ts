import 'server-only';
import type { NotCalculableReason } from '@sbn/engine';
import type { Section } from '@sbn/report/model';
import { errorFields, log } from '@/lib/log';
import type { SupabaseServerClient } from '@/lib/supabase/server';
import { loadReportPage, type ReportPageOptions } from './load';

/** What the result region of the project page draws (D-286). */
export type ProjectResult =
  /** Below the summary gate: there is no result to show yet. */
  | { readonly status: 'none' }
  /** The verdict section of the one-page summary: the word, and for a stop its three changes. */
  | { readonly status: 'verdict'; readonly section: Section }
  /** The answers are enough but the numbers cannot be calculated: what to answer or correct. */
  | { readonly status: 'needs_answers'; readonly reasons: readonly NotCalculableReason[] }
  /** Nothing could be built (logged). The rest of the project page stands. */
  | { readonly status: 'failed' };

/**
 * The check result for the project page (D-286). It is the first section of the one-page summary,
 * built by the report loader, so the page shows the same verdict word, and for a stop the same
 * three changes, as the report: one source, no second reading of the answers. It never throws: a
 * failure is logged and the page goes on without a result.
 */
export async function loadProjectResult(
  supabase: SupabaseServerClient,
  projectId: string,
  options: Omit<ReportPageOptions, 'summaryOnly'>,
): Promise<ProjectResult> {
  try {
    const page = await loadReportPage(supabase, projectId, { ...options, summaryOnly: true });
    if (page === null || page.status === 'failed') return { status: 'failed' };
    if (page.status === 'none') return { status: 'none' };
    const verdict = page.model.sections.find((section) => section.id === 'verdict');
    if (verdict !== undefined && !verdict.locked) return { status: 'verdict', section: verdict };
    if (page.notice?.kind === 'not_calculable') {
      return { status: 'needs_answers', reasons: page.notice.reasons };
    }
    return { status: 'failed' };
  } catch (error) {
    await log.error('project.result_failed', { ...errorFields(error), projectId });
    return { status: 'failed' };
  }
}
