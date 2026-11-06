import { errorFields, log } from '@/lib/log';
import type { SupabaseServerClient } from '@/lib/supabase/server';

/**
 * The rating before the PDF (D-345): one to five stars and an optional comment, once for each version
 * of the report, asked on the form that downloads it and checked again by the PDF route.
 */

export const RATING_COMMENT_MAX = 1000;

export interface RatingInput {
  readonly stars: number;
  readonly comment: string;
}

/** The stars and the comment of the download form, or null when the stars are not 1 to 5. */
export function parseRating(form: FormData): RatingInput | null {
  const raw = form.get('stars');
  if (typeof raw !== 'string' || !/^[1-5]$/.test(raw)) return null;
  const rawComment = form.get('comment');
  const comment = typeof rawComment === 'string' ? rawComment.trim() : '';
  return { stars: Number(raw), comment: comment.slice(0, RATING_COMMENT_MAX) };
}

/** The version a rating is kept under: 0 for a report that has no versions. */
export function ratingVersion(version: number | null): number {
  return version ?? 0;
}

/**
 * Whether the account already rated this version of its project: null when that cannot be read
 * (logged), which the page treats as "not rated" and the route as a failure.
 */
export async function hasReportRating(
  supabase: SupabaseServerClient,
  projectId: string,
  version: number | null,
): Promise<boolean | null> {
  const { data, error } = await supabase.rpc('has_report_rating', {
    p_project_id: projectId,
    p_version: ratingVersion(version),
  });
  if (error) {
    await log.error('report_rating.read_failed', { code: error.code });
    return null;
  }
  return data;
}

/** What the PDF route does about the rating: go on, ask for it, or fail. */
export type RatingGate = 'ok' | 'rating_required' | 'failed';

/**
 * Lets the PDF through when this version is rated, or when the form carries a rating, which is then
 * kept. Without either the route asks for the rating; an unreadable or unwritable rating is a
 * failure, never a way past the gate.
 */
export async function passRatingGate(
  supabase: SupabaseServerClient,
  projectId: string,
  version: number | null,
  form: FormData,
): Promise<RatingGate> {
  const rated = await hasReportRating(supabase, projectId, version);
  if (rated === null) return 'failed';
  const input = parseRating(form);
  if (rated && input === null) return 'ok';
  if (input === null) return 'rating_required';
  try {
    const { error } = await supabase.rpc('rate_report', {
      p_project_id: projectId,
      p_version: ratingVersion(version),
      p_stars: input.stars,
      p_comment: input.comment,
    });
    if (error) {
      await log.error('report_rating.write_failed', { code: error.code });
      return 'failed';
    }
    return 'ok';
  } catch (error) {
    await log.error('report_rating.write_failed', errorFields(error));
    return 'failed';
  }
}
