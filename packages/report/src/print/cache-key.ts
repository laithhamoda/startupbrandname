import { createHash } from 'node:crypto';
import type { ReportModel } from '../model/types';

/**
 * The version of the print template and its stylesheet (D-280). It is part of every cache key, so
 * a change to how a model is drawn makes the stored PDFs of the earlier look miss instead of being
 * served again. Raise it whenever the template, the CSS or the fonts change what a page looks like.
 */
export const PRINT_TEMPLATE_VERSION = 1;

/** JSON with the keys of every object in order, so the same value always gives the same text. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return value === undefined ? 'null' : JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, entry]) => entry !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`).join(',')}}`;
}

/**
 * The cache key of a report PDF (D-280): the sha256 of the canonical JSON of the model and the
 * template version. The model is deterministic and holds everything the page is made from (the
 * run's input hash, the pack items' labels, the day and the words), so the same key always means
 * the same pages, and a changed number, word or day gives a new key (CLAUDE.md rule 4).
 */
export function reportCacheKey(model: ReportModel): string {
  return createHash('sha256')
    .update(canonicalJson({ template: PRINT_TEMPLATE_VERSION, model }))
    .digest('hex');
}
