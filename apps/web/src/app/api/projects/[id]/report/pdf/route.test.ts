import type { ReportModel } from '@sbn/report/model';
import { buildReportModel } from '@sbn/report/model';
import { goldenReportInput } from '@sbn/report/testing/inputs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReportPage } from '@/lib/report/load';
import type { PdfStore } from '@/lib/report/pdf';

const ID = '22222222-2222-4222-8222-222222222222';
const USER = '11111111-1111-4111-8111-111111111111';
const SIGNED = 'https://storage.example.test/object/sign/reports/f.pdf?token=t';

const mocks = vi.hoisted(() => ({
  getSharedBrowser: vi.fn(),
  renderReportPdf: vi.fn(),
  createSupabaseServerClient: vi.fn(),
  getSessionUser: vi.fn(),
  loadReportPage: vi.fn(),
  createPdfStore: vi.fn(),
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@sbn/report', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@sbn/report')>()),
  getSharedBrowser: mocks.getSharedBrowser,
  renderReportPdf: mocks.renderReportPdf,
}));
vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: mocks.createSupabaseServerClient,
}));
vi.mock('@/lib/auth/session', () => ({ getSessionUser: mocks.getSessionUser }));
vi.mock('@/lib/report/load', () => ({ loadReportPage: mocks.loadReportPage }));
vi.mock('@/lib/report/pdf-store', () => ({ createPdfStore: mocks.createPdfStore }));
vi.mock('@/lib/log', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/log')>()),
  log: mocks.log,
}));

const route = await import('./route');

const model: ReportModel = buildReportModel(
  goldenReportInput('jo-service-subscription', { locale: 'ar' }),
);
const ready: ReportPage = { status: 'ready', model, notice: null, version: null };

function store(over: Partial<PdfStore> = {}): PdfStore {
  return {
    findStored: vi.fn(() => Promise.resolve(null)),
    mayRender: vi.fn(() => Promise.resolve(true)),
    record: vi.fn(() => Promise.resolve('ok' as const)),
    upload: vi.fn(() => Promise.resolve(true)),
    remove: vi.fn(() => Promise.resolve()),
    sign: vi.fn(() => Promise.resolve(SIGNED)),
    ...over,
  };
}

function post(
  options: {
    origin?: string | null;
    accept?: string;
    body?: Record<string, string>;
    id?: string;
  } = {},
) {
  const headers = new Headers({ host: 'site.example' });
  if (options.origin !== null) headers.set('origin', options.origin ?? 'https://site.example');
  if (options.accept !== undefined) headers.set('accept', options.accept);
  const request = new Request(`https://site.example/api/projects/${options.id ?? ID}/report/pdf`, {
    method: 'POST',
    headers,
    body: new URLSearchParams(options.body ?? { locale: 'ar' }),
  });
  return route.POST(request, { params: Promise.resolve({ id: options.id ?? ID }) });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createSupabaseServerClient.mockResolvedValue({});
  mocks.getSessionUser.mockResolvedValue({ id: USER, email: 'founder@example.test', names: [] });
  mocks.loadReportPage.mockResolvedValue(ready);
  mocks.createPdfStore.mockReturnValue(store());
  mocks.getSharedBrowser.mockResolvedValue({ browser: { id: 'browser' }, launched: false });
  mocks.renderReportPdf.mockResolvedValue({
    pdf: new Uint8Array([37, 80, 68, 70]),
    aborted: 0,
    ms: 1,
  });
});

describe('the report PDF route', () => {
  it('runs on Node.js with the time the measuring route showed enough, and answers POST only', () => {
    expect(route.runtime).toBe('nodejs');
    expect(route.maxDuration).toBe(60);
    expect(Object.keys(route).filter((name) => /^(GET|PUT|PATCH|DELETE|HEAD)$/.test(name))).toEqual(
      [],
    );
  });

  it('answers a 303 to the signed address, which is never cached', async () => {
    const response = await post();

    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe(SIGNED);
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('builds the report with the same loader as the page, for the user’s own session', async () => {
    await post({ body: { locale: 'en' } });

    expect(mocks.loadReportPage).toHaveBeenCalledWith({}, ID, {
      email: 'founder@example.test',
      locale: 'en',
      currencyLabel: expect.any(Function) as unknown,
    });
    const options = mocks.loadReportPage.mock.calls[0]?.[2] as {
      currencyLabel: (code: string) => string;
    };
    expect(options.currencyLabel('JOD')).toBe('JOD');
    expect(options.currencyLabel('XYZ')).toBe('XYZ');
    expect(mocks.createPdfStore).toHaveBeenCalledWith({});
  });

  it('writes the Arabic symbol of the currency in Arabic, as the page does', async () => {
    await post({ body: { locale: 'ar' } });
    const options = mocks.loadReportPage.mock.calls[0]?.[2] as {
      currencyLabel: (code: string) => string;
    };
    expect(options.currencyLabel('JOD')).toBe('د.أ');
  });

  it('renders with the shared browser', async () => {
    await post();
    expect(mocks.getSharedBrowser).toHaveBeenCalledTimes(1);
    expect(mocks.renderReportPdf).toHaveBeenCalledWith({
      model,
      browser: { id: 'browser' },
    });
  });

  it('falls back to Arabic when the form names no language, or one we do not have', async () => {
    await post({ body: {} });
    await post({ body: { locale: 'fr' } });
    expect(
      mocks.loadReportPage.mock.calls.map((call) => (call[2] as { locale: string }).locale),
    ).toEqual(['ar', 'ar']);
  });

  it('refuses a cross-site post before it touches the session', async () => {
    const response = await post({ origin: 'https://evil.example' });

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'not_allowed' });
    expect(mocks.createSupabaseServerClient).not.toHaveBeenCalled();
    expect(mocks.renderReportPdf).not.toHaveBeenCalled();
  });

  it('refuses a post with no origin that the browser does not call same-origin', async () => {
    expect((await post({ origin: null })).status).toBe(403);
  });

  it('says not found, as JSON, for an address that is not a project id', async () => {
    const response = await post({ id: 'not-a-uuid' });
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'not_found' });
    expect(mocks.createSupabaseServerClient).not.toHaveBeenCalled();
  });

  it('refuses a visitor who is not signed in', async () => {
    mocks.getSessionUser.mockResolvedValue(null);
    const response = await post();
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'not_allowed' });
    expect(mocks.loadReportPage).not.toHaveBeenCalled();
  });

  it('says not found, without a reason, for a project that is not the user’s', async () => {
    mocks.loadReportPage.mockResolvedValue(null);
    const response = await post();
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'not_found' });
  });

  it('refuses an account that has no report to show', async () => {
    mocks.loadReportPage.mockResolvedValue({ status: 'none', percent: 5, missing: [] });
    const response = await post();
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'not_allowed' });
  });

  it('answers 429 with the code of the limit to a script', async () => {
    mocks.createPdfStore.mockReturnValue(store({ mayRender: vi.fn(() => Promise.resolve(false)) }));
    const response = await post({ accept: 'application/json' });
    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({ error: 'limit' });
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('sends a form back to the report page with the code, for a message without JavaScript', async () => {
    mocks.createPdfStore.mockReturnValue(store({ mayRender: vi.fn(() => Promise.resolve(false)) }));
    const response = await post({
      accept: 'text/html,application/xhtml+xml',
      body: { locale: 'en' },
    });
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe(`/en/projects/${ID}/report?pdf=limit`);
  });

  it('answers a storage failure with its own status and code', async () => {
    mocks.createPdfStore.mockReturnValue(store({ upload: vi.fn(() => Promise.resolve(false)) }));
    const response = await post();
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: 'storage_failed' });
  });

  it('answers a render failure with its own status and code, and logs no model text', async () => {
    mocks.renderReportPdf.mockRejectedValue(new Error('the title was <script>'));
    const response = await post();
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'render_failed' });
    expect(JSON.stringify(mocks.log.error.mock.calls)).not.toContain('<script>');
  });

  it('turns anything thrown into a render failure instead of an error page', async () => {
    mocks.loadReportPage.mockRejectedValue(Object.assign(new Error('secret'), { name: 'Boom' }));
    const response = await post({ accept: 'text/html' });
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe(`/ar/projects/${ID}/report?pdf=render_failed`);
    expect(mocks.log.error).toHaveBeenCalledWith('report_pdf.failed', {
      errorName: 'Boom',
      stage: 'route',
      projectId: ID,
    });
    expect(JSON.stringify(mocks.log.error.mock.calls)).not.toContain('secret');
  });

  it('serves a stored file without rendering and without recording', async () => {
    const record = vi.fn(() => Promise.resolve('ok' as const));
    const cached = store({
      findStored: vi.fn(() => Promise.resolve(`${USER}/${ID}/old.pdf`)),
      record,
    });
    mocks.createPdfStore.mockReturnValue(cached);
    const response = await post();
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe(SIGNED);
    expect(mocks.renderReportPdf).not.toHaveBeenCalled();
    expect(record).not.toHaveBeenCalled();
  });
});
