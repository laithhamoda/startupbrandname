import { reportCacheKey } from '@sbn/report';
import { buildReportModel, type ReportModel } from '@sbn/report/model';
import { goldenReportInput } from '@sbn/report/testing/inputs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { log } from '@/lib/log';
import type { ReportPage } from './load';
import {
  MAX_PDF_BYTES,
  PDF_ERROR_CODES,
  PDF_ERROR_STATUS,
  isPdfErrorCode,
  isSameOrigin,
  pdfFileName,
  producePdf,
  storagePath,
  type PdfDeps,
  type PdfStore,
} from './pdf';
import { pdfDownloadAvailable } from './pdf-codes';

vi.mock('@/lib/log', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/log')>()),
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const USER = '11111111-1111-4111-8111-111111111111';
const PROJECT = '22222222-2222-4222-8222-222222222222';
const REPORT = '33333333-3333-4333-8333-333333333333';
const SIGNED = 'https://storage.example.test/object/sign/reports/file.pdf?token=t';
const PDF = new Uint8Array([37, 80, 68, 70, 45]);

const modelOf = (locale: 'ar' | 'en' = 'ar', kind: 'full' | 'summary' = 'full'): ReportModel =>
  buildReportModel(goldenReportInput('jo-service-subscription', { locale, kind }));

const ready = (model: ReportModel): ReportPage => ({
  status: 'ready',
  model,
  notice: null,
  version: null,
});

/** A store whose every call succeeds, with the calls it received. */
function fakeStore(over: Partial<PdfStore> = {}) {
  const store = {
    findStored: vi.fn(() => Promise.resolve<string | null>(null)),
    mayRender: vi.fn(() => Promise.resolve(true)),
    record: vi.fn(() => Promise.resolve<'ok' | 'limit' | 'refused' | 'failed'>('ok')),
    upload: vi.fn(() => Promise.resolve(true)),
    remove: vi.fn(() => Promise.resolve()),
    sign: vi.fn(() => Promise.resolve<string | null>(SIGNED)),
    ...over,
  };
  return store satisfies PdfStore;
}

function setup(over: Partial<PdfStore> = {}, render?: PdfDeps['render']) {
  const store = fakeStore(over);
  const renderMock = vi.fn(render ?? (() => Promise.resolve({ pdf: PDF })));
  const deps: PdfDeps = { store, render: renderMock, newId: () => REPORT };
  return { store, render: renderMock, deps };
}

const run = (deps: PdfDeps, page: ReportPage | null) =>
  producePdf(deps, { userId: USER, projectId: PROJECT, page });

beforeEach(() => {
  vi.clearAllMocks();
});

describe('producePdf', () => {
  it('limits, renders, records, uploads and signs, in that order', async () => {
    const order: string[] = [];
    const { deps, store, render } = setup(
      {
        mayRender: vi.fn(() => {
          order.push('limit');
          return Promise.resolve(true);
        }),
        record: vi.fn(() => {
          order.push('record');
          return Promise.resolve('ok' as const);
        }),
        upload: vi.fn(() => {
          order.push('upload');
          return Promise.resolve(true);
        }),
        sign: vi.fn(() => {
          order.push('sign');
          return Promise.resolve(SIGNED);
        }),
      },
      () => {
        order.push('render');
        return Promise.resolve({ pdf: PDF });
      },
    );
    const model = modelOf();

    const result = await run(deps, ready(model));

    expect(result).toEqual({ ok: true, url: SIGNED, cached: false });
    expect(order).toEqual(['limit', 'render', 'record', 'upload', 'sign']);
    expect(render).toHaveBeenCalledWith(model);
    expect(store.record).toHaveBeenCalledWith({
      reportId: REPORT,
      projectId: PROJECT,
      kind: 'full',
      locale: 'ar',
      audience: model.audience,
      inputHash: reportCacheKey(model),
      engineVersion: model.meta.engineVersion,
      path: `${USER}/${PROJECT}/${REPORT}.pdf`,
      bytes: PDF.byteLength,
    });
    expect(store.upload).toHaveBeenCalledWith(`${USER}/${PROJECT}/${REPORT}.pdf`, PDF);
    expect(store.sign).toHaveBeenCalledWith(
      `${USER}/${PROJECT}/${REPORT}.pdf`,
      'business-model-report-ar-2026-10-12.pdf',
    );
  });

  it('serves a stored file again without rendering and without counting against the limit', async () => {
    const stored = `${USER}/${PROJECT}/44444444-4444-4444-8444-444444444444.pdf`;
    const { deps, store, render } = setup({ findStored: vi.fn(() => Promise.resolve(stored)) });
    const model = modelOf('en');

    expect(await run(deps, ready(model))).toEqual({ ok: true, url: SIGNED, cached: true });

    expect(store.findStored).toHaveBeenCalledWith({
      projectId: PROJECT,
      inputHash: reportCacheKey(model),
      kind: 'full',
      locale: 'en',
    });
    expect(store.sign).toHaveBeenCalledWith(stored, 'business-model-report-en-2026-10-12.pdf');
    expect(render).not.toHaveBeenCalled();
    expect(store.mayRender).not.toHaveBeenCalled();
    expect(store.record).not.toHaveBeenCalled();
    expect(store.upload).not.toHaveBeenCalled();
  });

  it('looks a file up by the key of the model, so a changed number is a miss', async () => {
    const keys: string[] = [];
    const { deps } = setup({
      findStored: (key) => {
        keys.push(key.inputHash);
        return Promise.resolve(null);
      },
    });
    const changed = JSON.parse(
      JSON.stringify(modelOf()).replace('"18,400.000"', '"18,400.001"'),
    ) as ReportModel;
    await run(deps, ready(modelOf()));
    await run(deps, ready(changed));
    expect(keys).toHaveLength(2);
    expect(new Set(keys).size).toBe(2);
  });

  it('says not found, without a reason, for a project that is not the user’s', async () => {
    const { deps, store, render } = setup();
    expect(await run(deps, null)).toEqual({ ok: false, code: 'not_found' });
    expect(store.findStored).not.toHaveBeenCalled();
    expect(render).not.toHaveBeenCalled();
  });

  it('refuses an account that has no report to show', async () => {
    const { deps, store, render } = setup();
    const page: ReportPage = { status: 'none', percent: 10, missing: [] };
    expect(await run(deps, page)).toEqual({ ok: false, code: 'not_allowed' });
    expect(store.findStored).not.toHaveBeenCalled();
    expect(render).not.toHaveBeenCalled();
  });

  it('fails a render when the model could not be built', async () => {
    const { deps, render } = setup();
    expect(await run(deps, { status: 'failed' })).toEqual({ ok: false, code: 'render_failed' });
    expect(render).not.toHaveBeenCalled();
    expect(log.error).toHaveBeenCalledWith('report_pdf.failed', {
      stage: 'model',
      code: 'render_failed',
      projectId: PROJECT,
    });
  });

  it('draws the summary of a plan-locked account as it is, and keys it apart from the full report', async () => {
    const summary = modelOf('ar', 'summary');
    const { deps, store } = setup();
    expect(await run(deps, ready(summary))).toEqual({ ok: true, url: SIGNED, cached: false });
    expect(store.record).toHaveBeenCalledWith(expect.objectContaining({ kind: 'summary' }));
    expect(reportCacheKey(summary)).not.toBe(reportCacheKey(modelOf()));
  });

  it('refuses with the limit before it renders when today’s reports are used up', async () => {
    const { deps, store, render } = setup({ mayRender: vi.fn(() => Promise.resolve(false)) });
    expect(await run(deps, ready(modelOf()))).toEqual({ ok: false, code: 'limit' });
    expect(render).not.toHaveBeenCalled();
    expect(store.record).not.toHaveBeenCalled();
  });

  it('refuses with the limit when the database counts the report beyond it, and stores nothing', async () => {
    const { deps, store } = setup({ record: vi.fn(() => Promise.resolve('limit' as const)) });
    expect(await run(deps, ready(modelOf()))).toEqual({ ok: false, code: 'limit' });
    expect(store.upload).not.toHaveBeenCalled();
    expect(log.error).not.toHaveBeenCalled();
  });

  it('refuses when the database says the project or the path is not the user’s', async () => {
    const { deps, store } = setup({ record: vi.fn(() => Promise.resolve('refused' as const)) });
    expect(await run(deps, ready(modelOf()))).toEqual({ ok: false, code: 'not_allowed' });
    expect(store.upload).not.toHaveBeenCalled();
  });

  it('fails the storage when the report cannot be recorded', async () => {
    const { deps, store } = setup({ record: vi.fn(() => Promise.resolve('failed' as const)) });
    expect(await run(deps, ready(modelOf()))).toEqual({ ok: false, code: 'storage_failed' });
    expect(store.upload).not.toHaveBeenCalled();
  });

  it('records nothing and uploads nothing when the render fails, and logs no model text', async () => {
    const { deps, store } = setup({}, () =>
      Promise.reject(
        Object.assign(new Error('the title was <script>'), { name: 'PdfRenderError' }),
      ),
    );
    expect(await run(deps, ready(modelOf()))).toEqual({ ok: false, code: 'render_failed' });
    expect(store.record).not.toHaveBeenCalled();
    expect(store.upload).not.toHaveBeenCalled();
    expect(log.error).toHaveBeenCalledWith('report_pdf.failed', {
      stage: 'render',
      code: 'render_failed',
      projectId: PROJECT,
      errorName: 'PdfRenderError',
    });
    expect(JSON.stringify(vi.mocked(log.error).mock.calls)).not.toContain('<script>');
  });

  for (const [label, pdf] of [
    ['an empty', new Uint8Array(0)],
    ['an oversized', new Uint8Array(MAX_PDF_BYTES + 1)],
  ] as const) {
    it(`fails the render of ${label} file before anything is recorded`, async () => {
      const { deps, store } = setup({}, () => Promise.resolve({ pdf }));
      expect(await run(deps, ready(modelOf()))).toEqual({ ok: false, code: 'render_failed' });
      expect(store.record).not.toHaveBeenCalled();
    });
  }

  it('fails the storage, removes what it can and signs nothing when the upload fails', async () => {
    const { deps, store } = setup({ upload: vi.fn(() => Promise.resolve(false)) });
    expect(await run(deps, ready(modelOf()))).toEqual({ ok: false, code: 'storage_failed' });
    expect(store.remove).toHaveBeenCalledWith(`${USER}/${PROJECT}/${REPORT}.pdf`);
    expect(store.sign).not.toHaveBeenCalled();
  });

  it('fails the storage when the address of a stored file cannot be signed', async () => {
    const stored = `${USER}/${PROJECT}/44444444-4444-4444-8444-444444444444.pdf`;
    const cached = setup({
      findStored: vi.fn(() => Promise.resolve(stored)),
      sign: vi.fn(() => Promise.resolve(null)),
    });
    expect(await run(cached.deps, ready(modelOf()))).toEqual({ ok: false, code: 'storage_failed' });

    const fresh = setup({ sign: vi.fn(() => Promise.resolve(null)) });
    expect(await run(fresh.deps, ready(modelOf()))).toEqual({ ok: false, code: 'storage_failed' });
  });
});

describe('the file name and the path', () => {
  it('is ASCII, from the language and the day only', () => {
    expect(pdfFileName(modelOf('ar'))).toBe('business-model-report-ar-2026-10-12.pdf');
    expect(pdfFileName(modelOf('en'))).toBe('business-model-report-en-2026-10-12.pdf');
    // The founder's title never reaches the name.
    const titled = buildReportModel({
      ...goldenReportInput('jo-service-subscription', { locale: 'ar' }),
      project: {
        ...goldenReportInput('jo-service-subscription', { locale: 'ar' }).project,
        title: '../x"y',
      },
    });
    expect(pdfFileName(titled)).toBe('business-model-report-ar-2026-10-12.pdf');
    expect(pdfFileName(titled)).toMatch(/^[a-z0-9.-]+$/);
  });

  it('leaves out a day that is not a day', () => {
    const model = modelOf();
    expect(pdfFileName({ ...model, meta: { ...model.meta, issuedOn: 'x/../y' } })).toBe(
      'business-model-report-ar.pdf',
    );
  });

  it('is the path record_report() accepts', () => {
    expect(storagePath(USER, PROJECT, REPORT)).toBe(`${USER}/${PROJECT}/${REPORT}.pdf`);
  });
});

describe('isSameOrigin', () => {
  const post = (headers: Record<string, string>, url = 'https://site.example/api/p') =>
    new Request(url, { method: 'POST', headers });

  it('accepts the site’s own origin, by host', () => {
    expect(isSameOrigin(post({ origin: 'https://site.example', host: 'site.example' }))).toBe(true);
  });

  it('uses the forwarded host behind the platform’s proxy', () => {
    expect(
      isSameOrigin(
        post({
          origin: 'https://startupbrandname.com',
          host: 'internal.example',
          'x-forwarded-host': 'startupbrandname.com, other',
        }),
      ),
    ).toBe(true);
  });

  it('refuses another site, another port and an origin that is not an address', () => {
    expect(isSameOrigin(post({ origin: 'https://evil.example', host: 'site.example' }))).toBe(
      false,
    );
    expect(isSameOrigin(post({ origin: 'https://site.example:8443', host: 'site.example' }))).toBe(
      false,
    );
    expect(isSameOrigin(post({ origin: 'null', host: 'site.example' }))).toBe(false);
  });

  it('falls back to the address of the request when no host header was sent', () => {
    expect(isSameOrigin(post({ origin: 'https://site.example' }))).toBe(true);
    expect(isSameOrigin(post({ origin: 'https://evil.example' }))).toBe(false);
  });

  it('without an origin, accepts only what the browser calls same-origin', () => {
    expect(isSameOrigin(post({ 'sec-fetch-site': 'same-origin' }))).toBe(true);
    expect(isSameOrigin(post({ 'sec-fetch-site': 'cross-site' }))).toBe(false);
    expect(isSameOrigin(post({}))).toBe(false);
  });
});

describe('the codes', () => {
  it('give each refusal a status the button can show, and know their own names', () => {
    expect(PDF_ERROR_CODES.slice().sort()).toEqual(
      ['limit', 'not_allowed', 'not_found', 'render_failed', 'storage_failed'].sort(),
    );
    expect(PDF_ERROR_STATUS.limit).toBe(429);
    expect(PDF_ERROR_STATUS.not_found).toBe(404);
    expect(isPdfErrorCode('limit')).toBe(true);
    expect(isPdfErrorCode('other')).toBe(false);
    expect(isPdfErrorCode(undefined)).toBe(false);
  });

  it('offer the download for every report the page draws and for no other', () => {
    expect(pdfDownloadAvailable(ready(modelOf()))).toBe(true);
    expect(pdfDownloadAvailable(ready(modelOf('ar', 'summary')))).toBe(true);
    expect(pdfDownloadAvailable({ status: 'none', percent: 0, missing: [] })).toBe(false);
    expect(pdfDownloadAvailable({ status: 'failed' })).toBe(false);
  });
});
