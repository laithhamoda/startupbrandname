import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const report = vi.hoisted(() => ({
  buildSpikeFixture: vi.fn(),
  getSharedBrowser: vi.fn(),
  renderPdf: vi.fn(),
}));
const log = vi.hoisted(() => ({ info: vi.fn(), error: vi.fn() }));

vi.mock('@sbn/report', () => ({
  ...report,
  PdfRenderError: class PdfRenderError extends Error {
    constructor(
      readonly code: string,
      message: string,
    ) {
      super(message);
    }
  },
}));
vi.mock('@/lib/log', () => ({ log }));

const { GET, maxDuration, runtime } = await import('./route');
const { PdfRenderError } = await import('@sbn/report');

const request = (query = '') => new Request(`https://example.test/api/internal/pdf-spike${query}`);

describe('the temporary PDF spike route', () => {
  beforeEach(() => {
    report.buildSpikeFixture.mockResolvedValue({ html: '<html></html>', headerTitle: 'Title' });
    report.getSharedBrowser.mockResolvedValue({ browser: {}, launched: true });
    report.renderPdf.mockResolvedValue({
      pdf: new Uint8Array([37, 80, 68, 70]),
      aborted: 0,
      ms: 123,
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it('runs on Node.js and may take a minute', () => {
    expect(runtime).toBe('nodejs');
    expect(maxDuration).toBe(60);
  });

  for (const environment of ['production', 'development', undefined]) {
    it(`answers 404 and renders nothing outside a preview (VERCEL_ENV=${String(environment)})`, async () => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('VERCEL_ENV', environment ?? '');

      const response = await GET(request());

      expect(response.status).toBe(404);
      expect(report.getSharedBrowser).not.toHaveBeenCalled();
      expect(report.renderPdf).not.toHaveBeenCalled();
    });
  }

  it('renders the Arabic fixture on a Vercel preview, with the measurements in headers', async () => {
    vi.stubEnv('VERCEL_ENV', 'preview');

    const response = await GET(request());

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/pdf');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('x-pdf-ms')).toBe('123');
    expect(response.headers.get('x-pdf-cold')).toBe('true');
    expect(response.headers.get('x-pdf-bytes')).toBe('4');
    expect(response.headers.get('x-pdf-aborted')).toBe('0');
    expect(response.headers.get('x-pdf-launch-ms')).toMatch(/^\d+$/);
    expect(response.headers.get('x-pdf-node-rss-mb')).toMatch(/^\d+$/);
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array([37, 80, 68, 70]));
    expect(report.buildSpikeFixture).toHaveBeenCalledWith('ar');
    expect(report.renderPdf).toHaveBeenCalledWith(expect.objectContaining({ locale: 'ar' }));
  });

  it('renders the English fixture for ?locale=en, and Arabic for anything else', async () => {
    vi.stubEnv('VERCEL_ENV', 'preview');

    await GET(request('?locale=en'));
    expect(report.buildSpikeFixture).toHaveBeenLastCalledWith('en');
    await GET(request('?locale=fr'));
    expect(report.buildSpikeFixture).toHaveBeenLastCalledWith('ar');
  });

  it('also works on a laptop running next dev, and reports a warm browser', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    report.getSharedBrowser.mockResolvedValue({ browser: {}, launched: false });

    const response = await GET(request());

    expect(response.status).toBe(200);
    expect(response.headers.get('x-pdf-cold')).toBe('false');
  });

  it('answers 500 with the error code only, and never the cause', async () => {
    vi.stubEnv('VERCEL_ENV', 'preview');
    report.getSharedBrowser.mockRejectedValue(
      new PdfRenderError('launch_failed', 'The PDF browser did not start.'),
    );

    const response = await GET(request());

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'launch_failed' });
    expect(log.error).toHaveBeenCalledWith('pdf_spike.failed', { code: 'launch_failed' });
  });

  it('adds the first 400 characters of the message only when ?detail=1 asks for it', async () => {
    vi.stubEnv('VERCEL_ENV', 'preview');
    report.getSharedBrowser.mockRejectedValue(new Error('x'.repeat(500)));

    const response = await GET(request('?detail=1'));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'unknown', detail: 'x'.repeat(400) });
  });

  it('answers 500 unknown for any other failure', async () => {
    vi.stubEnv('VERCEL_ENV', 'preview');
    report.renderPdf.mockRejectedValue(new Error('secret detail'));

    const response = await GET(request());

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'unknown' });
  });
});
