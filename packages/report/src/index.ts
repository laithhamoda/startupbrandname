// Report assembly, HTML templates and PDF rendering. Built in M5; this is the PDF foundation of
// step 0 (D-235, D-239 to D-241): the print document, the browser launcher and renderPdf().
// The report content arrives in steps 5 and 6.
export { escapeHtml } from './print/escape';
export { PRINT_CSP, PRINT_CSP_META } from './print/csp';
export { PRINT_TOKENS, WIDE_PAGE_NAME, buildPrintCss, type PrintCssOptions } from './print/css';
export { PRINT_TEMPLATE_VERSION, canonicalJson, reportCacheKey } from './print/cache-key';
export {
  buildReportDocument,
  reportBodyHtml,
  reportTitle,
  type ReportDocumentOptions,
} from './print/report';
export {
  buildPrintDocument,
  isolatedLatin,
  isolatedNumber,
  type PrintDocumentInput,
} from './print/document';
export {
  FontFileError,
  PRINT_FONT_FACES,
  loadFontFaceCss,
  type FontFace,
  type FontFamily,
  type FontSubset,
} from './print/fonts';
export { directionOf, type Direction, type PrintLocale } from './print/locale';
export { PdfRenderError, type PdfErrorCode } from './render/errors';
export { launchBrowser, resolveLocalExecutable, type LaunchOptions } from './render/launch';
export {
  renderPdf,
  renderReportPdf,
  type RenderPdfInput,
  type RenderPdfResult,
  type RenderReportInput,
} from './render/pdf';
export { closeSharedBrowser, getSharedBrowser } from './render/shared';
export {
  HOSTILE_EFFECT,
  HOSTILE_TEXT,
  buildSpikeFixture,
  type SpikeFixture,
} from './fixtures/spike';
