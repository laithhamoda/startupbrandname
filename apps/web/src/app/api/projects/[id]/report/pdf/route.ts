import { randomUUID } from 'node:crypto';
import { renderReportPdf, getSharedBrowser } from '@sbn/report';
import { z } from 'zod';
import { catalogues } from '@/i18n/messages';
import { getSessionUser } from '@/lib/auth/session';
import { reportPath } from '@/lib/diagnostic/steps';
import { errorFields, log } from '@/lib/log';
import { loadReportPage } from '@/lib/report/load';
import {
  PDF_ERROR_STATUS,
  isSameOrigin,
  producePdf,
  type PdfErrorCode,
  type PdfResult,
} from '@/lib/report/pdf';
import { createPdfStore } from '@/lib/report/pdf-store';
import { createSupabaseServerClient } from '@/lib/supabase/server';

// The report as a PDF (M5 step 6, D-280, D-281). Headless Chromium runs inside the function: Node
// runtime, the Frankfurt region the whole project is pinned to (vercel.json), and as long as the
// spike route of step 0 measured as enough (D-242). The function's memory is the platform's default.
export const runtime = 'nodejs';
export const maxDuration = 60;

const idSchema = z.uuid();
const formSchema = z.object({ locale: z.enum(['ar', 'en']) });

const NO_STORE = { 'cache-control': 'no-store' } as const;

function json(code: PdfErrorCode, status: number = PDF_ERROR_STATUS[code]): Response {
  return Response.json({ error: code }, { status, headers: NO_STORE });
}

/** A browser form asks for a page, and a script for data: the first is sent back to the report. */
function wantsPage(request: Request): boolean {
  return request.headers.get('accept')?.includes('text/html') === true;
}

function refusal(
  request: Request,
  code: PdfErrorCode,
  back: { readonly id: string; readonly locale: 'ar' | 'en' },
): Response {
  if (!wantsPage(request)) return json(code);
  const location = `/${back.locale}${reportPath(back.id)}?pdf=${code}`;
  return new Response(null, { status: 303, headers: { location, ...NO_STORE } });
}

function answer(
  request: Request,
  result: PdfResult,
  back: Parameters<typeof refusal>[2],
): Response {
  if (!result.ok) return refusal(request, result.code, back);
  // The signed address is short-lived and made for this request: it is never cached.
  return new Response(null, { status: 303, headers: { location: result.url, ...NO_STORE } });
}

/**
 * POST /api/projects/[id]/report/pdf, from the form on the report page. Only this site's own pages
 * may post (the Origin header); the session is the user's own, so the project is found through row
 * level security and its absence is a plain not found. The report is the one the page shows
 * (loadReportPage), made into a PDF or served again from the bucket, and the answer is a 303 to a
 * signed address of the file. A refusal is JSON with a code for a script, and a redirect back to the
 * report page with `?pdf=<code>` for a form, which shows the message without any client JavaScript.
 * No model text reaches a log line.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  if (!isSameOrigin(request)) return json('not_allowed');
  const id = idSchema.safeParse((await context.params).id);
  if (!id.success) return json('not_found');

  const form = formSchema.safeParse({
    locale: (await request.formData().catch(() => new FormData())).get('locale'),
  });
  const locale = form.success ? form.data.locale : 'ar';
  const back = { id: id.data, locale } as const;

  try {
    const supabase = await createSupabaseServerClient();
    const user = await getSessionUser(supabase);
    if (!user) return json('not_allowed', 401);

    const symbols: Record<string, string> = catalogues[locale].money.symbol;
    const page = await loadReportPage(supabase, id.data, {
      email: user.email,
      locale,
      currencyLabel: (code) => symbols[code] ?? code,
    });

    const result = await producePdf(
      {
        store: createPdfStore(supabase),
        render: async (model) => {
          const { browser } = await getSharedBrowser();
          return renderReportPdf({ model, browser });
        },
        newId: randomUUID,
      },
      { userId: user.id, projectId: id.data, page },
    );
    return answer(request, result, back);
  } catch (error) {
    await log.error('report_pdf.failed', {
      ...errorFields(error),
      stage: 'route',
      projectId: id.data,
    });
    return refusal(request, 'render_failed', back);
  }
}
