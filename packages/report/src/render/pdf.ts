import { performance } from 'node:perf_hooks';
import type { Browser } from 'puppeteer-core';
import { PRINT_CSP_META } from '../print/csp';
import type { ReportModel } from '../model/types';
import { loadFontFaceCss, type FontFace } from '../print/fonts';
import type { PrintLocale } from '../print/locale';
import { buildReportDocument, reportTitle } from '../print/report';
import { PdfRenderError } from './errors';
import { launchBrowser } from './launch';
import { footerTemplate, headerTemplate } from './template';

export interface RenderPdfInput {
  /** A whole document from buildPrintDocument(): escaped text only, the policy tag in the head. */
  html: string;
  locale: PrintLocale;
  /** Shown in the running header of every page (plain text). */
  headerTitle: string;
  /**
   * A browser to reuse. Without one, renderPdf starts its own and closes it, which is the right
   * thing in a function that serves one request and then may be frozen.
   */
  browser?: Browser;
  /**
   * Refuses a document without the content security policy tag. On by default; only the test that
   * proves the second layer (the request filter) turns it off.
   */
  requireCsp?: boolean;
  /**
   * The bookmarks of the PDF viewer, made from the headings. Chromium writes a heading's words in
   * the order they are drawn, so an Arabic title of several words comes out reversed (D-240):
   * off by default for Arabic, on for English.
   */
  outline?: boolean;
  /**
   * Where the page number comes from. `footer` (the default) is the footer template, which the
   * spike document of step 0 uses; `css` means the document draws it itself with an `@page` margin
   * box (buildPrintCss, D-284) and the footer stays empty, so a page never carries two numbers.
   */
  pageNumbers?: 'footer' | 'css';
}

export interface RenderPdfResult {
  pdf: Uint8Array;
  /** Requests the filter aborted. The policy already blocks most, so this is normally 0. */
  aborted: number;
  /** Milliseconds from opening the page to the finished PDF; a browser start is not counted. */
  ms: number;
}

/** The header and footer carry text in both scripts, so both Tajawal 400 subsets. */
const TEMPLATE_FONTS: readonly FontFace[] = [
  { family: 'Tajawal', weight: 400, subset: 'arabic' },
  { family: 'Tajawal', weight: 400, subset: 'latin' },
];

/**
 * Turns a print document into a PDF with headless Chromium (D-235). Defence in depth, because the
 * document holds a founder's text: it is escaped when built, the policy forbids every fetch,
 * JavaScript is off, and any request that is not a data: URL is aborted and counted.
 *
 * Options that worked on Chromium 153 with Puppeteer 25.11 (docs/DECISIONS.md D-240): A4,
 * printBackground, preferCSSPageSize (the named landscape page), a header and a footer template,
 * `tagged` and `outline`.
 */
export async function renderPdf(input: RenderPdfInput): Promise<RenderPdfResult> {
  const { html, locale, headerTitle } = input;
  if ((input.requireCsp ?? true) && !html.includes(PRINT_CSP_META)) {
    throw new PdfRenderError('input_rejected', 'The document has no content security policy tag.');
  }

  const templateFonts = await loadFontFaceCss(TEMPLATE_FONTS);
  const browser = input.browser ?? (await launchBrowser());
  const startedAt = performance.now();
  let aborted = 0;
  try {
    const page = await browser.newPage();
    try {
      await page.setJavaScriptEnabled(false);
      await page.setRequestInterception(true);
      page.on('request', (request) => {
        if (request.url().startsWith('data:')) {
          void request.continue();
        } else {
          aborted += 1;
          void request.abort('blockedbyclient');
        }
      });
      await page.setContent(html, { waitUntil: 'load' });
      // The inlined fonts are decoded when first used: wait until every face is ready.
      await page.evaluate('document.fonts.ready.then(() => document.fonts.size)');
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        preferCSSPageSize: true,
        displayHeaderFooter: true,
        headerTemplate: headerTemplate({ locale, title: headerTitle, fontCss: templateFonts }),
        // A non-empty template, so Chromium does not draw its own date, title and address.
        footerTemplate:
          input.pageNumbers === 'css'
            ? '<span></span>'
            : footerTemplate({ locale, fontCss: templateFonts }),
        tagged: true,
        outline: input.outline ?? locale !== 'ar',
      });
      return { pdf, aborted, ms: Math.round(performance.now() - startedAt) };
    } finally {
      await page.close().catch(() => undefined);
    }
  } catch (error) {
    if (error instanceof PdfRenderError) throw error;
    throw new PdfRenderError('render_failed', 'The page could not be turned into a PDF.', {
      cause: error,
    });
  } finally {
    if (!input.browser) await browser.close().catch(() => undefined);
  }
}

export interface RenderReportInput {
  readonly model: ReportModel;
  /** A browser to reuse, as in renderPdf. */
  readonly browser?: Browser;
  /** Defaults to the print set, as in buildReportDocument. */
  readonly fontCss?: string;
}

/**
 * The PDF of a report (M5 step 6): the print document of the model, rendered with the page number
 * drawn by the document and the project's title as the running header. The PDF's own title is the
 * document title, which is the project's title too (D-279).
 */
export async function renderReportPdf(input: RenderReportInput): Promise<RenderPdfResult> {
  const { model } = input;
  const html = await buildReportDocument(model, {
    ...(input.fontCss === undefined ? {} : { fontCss: input.fontCss }),
  });
  return renderPdf({
    html,
    locale: model.locale,
    headerTitle: reportTitle(model),
    pageNumbers: 'css',
    ...(input.browser === undefined ? {} : { browser: input.browser }),
  });
}
