import { REPORT_VERSIONS } from '@/config/plans';

/**
 * Report versions of a paid project (D-321, D-323), as the app reads them. The database enforces
 * the same limits (record_report_version() and the versions.* settings); this module only says
 * what the page shows.
 */

export type VersionVerdict = 'go' | 'revise' | 'stop';

/** A row of report_versions, without the copy of the answers. */
export interface VersionRow {
  readonly number: number;
  readonly verdict: string;
  readonly input_hash: string;
  readonly created_at: string;
}

export interface VersionSummary {
  readonly number: number;
  readonly verdict: VersionVerdict;
  readonly createdAt: string;
}

function isVerdict(value: string): value is VersionVerdict {
  return value === 'go' || value === 'revise' || value === 'stop';
}

/** The versions in order, each with a verdict the page can name. */
export function summariesOf(rows: readonly VersionRow[]): VersionSummary[] {
  return [...rows]
    .sort((a, b) => a.number - b.number)
    .map((row) => ({
      number: row.number,
      verdict: isVerdict(row.verdict) ? row.verdict : 'revise',
      createdAt: row.created_at,
    }));
}

/**
 * How many more versions the project may record: at most `max` in all, and at most `afterGo` after
 * the first version that says «امضِ».
 */
export function versionsLeft(
  rows: readonly VersionRow[],
  limits: { readonly max: number; readonly afterGo: number } = REPORT_VERSIONS,
): number {
  const last = rows.reduce((top, row) => Math.max(top, row.number), 0);
  const goes = rows.filter((row) => row.verdict === 'go').map((row) => row.number);
  const byMax = limits.max - last;
  const byGo = goes.length === 0 ? byMax : limits.afterGo - (last - Math.min(...goes));
  return Math.max(0, Math.min(byMax, byGo));
}

/** The next version's number. */
export function nextVersion(rows: readonly VersionRow[]): number {
  return rows.reduce((top, row) => Math.max(top, row.number), 0) + 1;
}
