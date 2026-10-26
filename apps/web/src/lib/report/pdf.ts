import 'server-only';
import { reportCacheKey } from '@sbn/report';
import type { ReportModel } from '@sbn/report/model';
import { errorFields, log } from '@/lib/log';
import type { ReportPage } from './load';
import type { PdfErrorCode } from './pdf-codes';

export { PDF_ERROR_CODES, PDF_ERROR_STATUS, isPdfErrorCode, type PdfErrorCode } from './pdf-codes';

/*
 * The decisions of the PDF route (M5 step 6, D-280, D-281), apart from Next.js and from Supabase:
 * everything the route does to the outside world goes through `PdfDeps`, so each refusal can be
 * tested with fakes. The route only reads the request, builds the dependencies and answers.
 */

/** The private bucket of the stored reports (D-244). */
export const REPORTS_BUCKET = 'reports';

/** How long the signed address of a file works: enough to start the download. */
export const PDF_URL_SECONDS = 120;

/** The bucket refuses a larger file (the migration sets 10 MB); a larger PDF is a failed render. */
export const MAX_PDF_BYTES = 10 * 1024 * 1024;

/** `{user_id}/{project_id}/{report_id}.pdf`: the only path record_report() accepts (D-234). */
export function storagePath(userId: string, projectId: string, reportId: string): string {
  return `${userId}/${projectId}/${reportId}.pdf`;
}

/**
 * The name the browser saves the file under: ASCII, from the language and the day only, never from
 * what the founder typed (D-281). A day that is not `YYYY-MM-DD` is left out.
 */
export function pdfFileName(model: Pick<ReportModel, 'locale' | 'meta'>): string {
  const day = /^\d{4}-\d{2}-\d{2}$/.test(model.meta.issuedOn) ? `-${model.meta.issuedOn}` : '';
  return `business-model-report-${model.locale}${day}.pdf`;
}

/**
 * Whether a POST comes from this site's own pages. A browser sends `Origin` with every POST; the
 * host in it must be the host the request was made to (behind Vercel, the forwarded one). Without
 * `Origin`, only a request the browser itself calls same-origin is accepted.
 */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (origin === null) return request.headers.get('sec-fetch-site') === 'same-origin';
  const forwarded = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
  const host = forwarded ?? request.headers.get('host') ?? new URL(request.url).host;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/** What the record step answers. */
export type RecordOutcome = 'ok' | 'limit' | 'refused' | 'failed';

export interface RecordInput {
  readonly reportId: string;
  readonly projectId: string;
  readonly kind: string;
  readonly locale: string;
  readonly audience: string;
  readonly inputHash: string;
  readonly engineVersion: string;
  readonly path: string;
  readonly bytes: number;
}

/** The database and the bucket, as the route uses them, with the signed-in user's own session. */
export interface PdfStore {
  /** The path of a stored file made from the same key, when its file is still in the bucket. */
  findStored(input: {
    projectId: string;
    inputHash: string;
    kind: string;
    locale: string;
  }): Promise<string | null>;
  /** False when the user has used up today's reports. A failed read answers true: record decides. */
  mayRender(): Promise<boolean>;
  record(input: RecordInput): Promise<RecordOutcome>;
  upload(path: string, pdf: Uint8Array): Promise<boolean>;
  remove(path: string): Promise<void>;
  sign(path: string, fileName: string): Promise<string | null>;
}

export interface PdfDeps {
  readonly store: PdfStore;
  readonly render: (model: ReportModel) => Promise<{ readonly pdf: Uint8Array }>;
  readonly newId: () => string;
}

export type PdfResult =
  | { readonly ok: true; readonly url: string; readonly cached: boolean }
  | { readonly ok: false; readonly code: PdfErrorCode };

const refuse = (code: PdfErrorCode): PdfResult => ({ ok: false, code });

/**
 * Makes the PDF of a project's report for the signed-in user, or says why not (D-280, D-281).
 *
 * 1. Not the user's project is not found; no report to show is not allowed; a model that could not
 *    be built is a failed render. The report is the one the page shows: `page` is what
 *    loadReportPage built, so a plan-locked account gets the locked summary and nothing more.
 * 2. The key is the hash of the model. A stored file with that key is served again with a new
 *    signed address, without rendering and without counting against the limit (rule 4).
 * 3. Otherwise: the limit is checked before the browser starts, the PDF is rendered, record_report
 *    counts it (the authoritative limit, with the size), and the file is uploaded under the path the
 *    row names. Only then is the address signed. A half-written file is never served: the address
 *    is made after the upload returned, and a failed upload removes what it can.
 */
export async function producePdf(
  deps: PdfDeps,
  input: { readonly userId: string; readonly projectId: string; readonly page: ReportPage | null },
): Promise<PdfResult> {
  const { userId, projectId, page } = input;
  const { store } = deps;
  const fail = async (code: PdfErrorCode, stage: string, error?: unknown): Promise<PdfResult> => {
    await log.error('report_pdf.failed', {
      stage,
      code,
      projectId,
      ...(error === undefined ? {} : { errorName: errorFields(error).errorName }),
    });
    return refuse(code);
  };

  if (page === null) return refuse('not_found');
  if (page.status === 'none' || page.status === 'version_needed') return refuse('not_allowed');
  if (page.status === 'failed') return fail('render_failed', 'model');

  const { model } = page;
  const key = {
    projectId,
    inputHash: reportCacheKey(model),
    kind: model.kind,
    locale: model.locale,
  };
  const fileName = pdfFileName(model);

  const stored = await store.findStored(key);
  if (stored !== null) {
    const url = await store.sign(stored, fileName);
    if (url === null) return fail('storage_failed', 'sign_cached');
    await log.info('report_pdf.served', { stage: 'cached', projectId });
    return { ok: true, url, cached: true };
  }

  if (!(await store.mayRender())) return refuse('limit');

  let pdf: Uint8Array;
  try {
    pdf = (await deps.render(model)).pdf;
  } catch (error) {
    return fail('render_failed', 'render', error);
  }
  if (pdf.byteLength === 0 || pdf.byteLength > MAX_PDF_BYTES) {
    return fail('render_failed', 'size');
  }

  const reportId = deps.newId();
  const path = storagePath(userId, projectId, reportId);
  const recorded = await store.record({
    reportId,
    projectId,
    kind: model.kind,
    locale: model.locale,
    audience: model.audience,
    inputHash: key.inputHash,
    engineVersion: model.meta.engineVersion ?? 'none',
    path,
    bytes: pdf.byteLength,
  });
  if (recorded === 'limit') return refuse('limit');
  if (recorded === 'refused') return fail('not_allowed', 'record');
  if (recorded === 'failed') return fail('storage_failed', 'record');

  if (!(await store.upload(path, pdf))) {
    // The row stays: a user has no right to delete it. It names no file, so it is never served,
    // and the next try renders again under a new id (D-281).
    await store.remove(path);
    return fail('storage_failed', 'upload');
  }
  const url = await store.sign(path, fileName);
  if (url === null) return fail('storage_failed', 'sign');
  await log.info('report_pdf.served', { stage: 'rendered', projectId });
  return { ok: true, url, cached: false };
}
