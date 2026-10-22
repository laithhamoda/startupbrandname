import { readFile } from 'node:fs/promises';
import {
  PdfRenderError,
  buildSpikeFixture,
  getSharedBrowser,
  renderPdf,
  renderReportPdf,
  type PrintLocale,
} from '@sbn/report';
import { buildReportModel } from '@sbn/report/model';
import { goldenReportInput } from '@sbn/report/testing/inputs';
import { log } from '@/lib/log';

// TEMPORARY (M5 step 0, D-239): a measuring route for the PDF spike. It exists on a Vercel preview
// and on a laptop running `next dev`, never in production. It stays through step 6 (D-285) until the
// lead has measured a real report of about fifteen pages on a preview, and is then removed. The page
// holds no user data, only the literal fixture or the golden project of the engine's tests.
export const runtime = 'nodejs';
export const maxDuration = 60;

function isAvailable(): boolean {
  return process.env.VERCEL_ENV === 'preview' || process.env.NODE_ENV === 'development';
}

async function renderSpike(
  locale: PrintLocale,
  browser: Awaited<ReturnType<typeof getSharedBrowser>>['browser'],
) {
  const fixture = await buildSpikeFixture(locale);
  return renderPdf({ html: fixture.html, locale, headerTitle: fixture.headerTitle, browser });
}

/** The peak memory of the whole container, Chromium included, where the platform shows it. */
async function cgroupPeakMb(): Promise<string> {
  for (const path of [
    '/sys/fs/cgroup/memory.peak',
    '/sys/fs/cgroup/memory/memory.max_usage_in_bytes',
  ]) {
    try {
      const bytes = Number((await readFile(path, 'utf8')).trim());
      if (Number.isFinite(bytes)) return String(Math.round(bytes / 1_048_576));
    } catch {
      // The file does not exist on every platform.
    }
  }
  return 'n/a';
}

/**
 * The Arabic spike PDF, or the English one with ?locale=en, or, with ?report=golden, the full golden
 * report of the Jordanian service project drawn by the real print template (M5 step 6, D-285). What
 * the lead measures is in the response headers: x-pdf-ms (the render), x-pdf-cold (this call
 * started the browser, so it paid the 1 to 3 seconds of a cold start), x-pdf-launch-ms,
 * x-pdf-bytes, x-pdf-aborted (requests the filter had to abort), x-pdf-node-rss-mb (the Node
 * process only, without Chromium), x-pdf-cgroup-peak-mb (the whole container, when it is shown),
 * x-pdf-region and x-pdf-node. A failure answers with its code only; with ?detail=1 it adds the
 * first 400 characters of the message, which is what tells a packaging problem from a real limit
 * on the protected preview.
 */
export async function GET(request: Request): Promise<Response> {
  if (!isAvailable()) return new Response('Not found', { status: 404 });

  const query = new URL(request.url).searchParams;
  const locale: PrintLocale = query.get('locale') === 'en' ? 'en' : 'ar';
  const wantsDetail = query.get('detail') === '1';
  try {
    const launchStartedAt = performance.now();
    const { browser, launched } = await getSharedBrowser();
    const launchMs = Math.round(performance.now() - launchStartedAt);

    const golden = query.get('report') === 'golden';
    const { pdf, aborted, ms } = golden
      ? await renderReportPdf({
          model: buildReportModel(goldenReportInput('jo-service-subscription', { locale })),
          browser,
        })
      : await renderSpike(locale, browser);
    await log.info('pdf_spike.rendered', { count: aborted, stage: launched ? 'cold' : 'warm' });

    return new Response(new Uint8Array(pdf), {
      headers: {
        'content-type': 'application/pdf',
        'content-disposition': `inline; filename="${golden ? 'golden-report' : 'pdf-spike'}-${locale}.pdf"`,
        'cache-control': 'no-store',
        'x-pdf-ms': String(ms),
        'x-pdf-cold': String(launched),
        'x-pdf-launch-ms': String(launchMs),
        'x-pdf-bytes': String(pdf.byteLength),
        'x-pdf-aborted': String(aborted),
        'x-pdf-node-rss-mb': String(Math.round(process.memoryUsage().rss / 1_048_576)),
        'x-pdf-cgroup-peak-mb': await cgroupPeakMb(),
        'x-pdf-region': process.env.VERCEL_REGION ?? 'local',
        'x-pdf-node': process.version,
      },
    });
  } catch (error) {
    const code = error instanceof PdfRenderError ? error.code : 'unknown';
    await log.error('pdf_spike.failed', { code });
    return Response.json(
      wantsDetail && error instanceof Error
        ? { error: code, detail: error.message.slice(0, 400) }
        : { error: code },
      { status: 500, headers: { 'cache-control': 'no-store' } },
    );
  }
}
