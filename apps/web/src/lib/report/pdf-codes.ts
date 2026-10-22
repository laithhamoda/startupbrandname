import type { ReportPage } from './load';

/*
 * What the page and the route both need to know about the PDF, without anything heavy: the page
 * imports this file, and must not load the renderer (M5 step 6, D-280).
 */

/** What the route answers with when it refuses. The words of a code live in the messages. */
export type PdfErrorCode =
  'limit' | 'not_allowed' | 'render_failed' | 'storage_failed' | 'not_found';

export const PDF_ERROR_STATUS: Readonly<Record<PdfErrorCode, number>> = {
  limit: 429,
  not_allowed: 403,
  render_failed: 500,
  storage_failed: 502,
  not_found: 404,
};

export const PDF_ERROR_CODES = Object.keys(PDF_ERROR_STATUS) as readonly PdfErrorCode[];

export function isPdfErrorCode(value: unknown): value is PdfErrorCode {
  return typeof value === 'string' && (PDF_ERROR_CODES as readonly string[]).includes(value);
}

/**
 * Whether the page offers the PDF: for every report it draws, the summary of any account included
 * (a plan-locked account gets the locked summary, never more than the page shows, D-280), and for
 * none that it cannot draw: below the summary gate, or when the model could not be built.
 */
export function pdfDownloadAvailable(page: ReportPage): boolean {
  return page.status === 'ready';
}
