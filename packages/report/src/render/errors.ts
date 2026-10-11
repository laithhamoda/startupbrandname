export type PdfErrorCode =
  /** No Chromium executable could be found (not on Vercel, no PDF_CHROMIUM_PATH). */
  | 'browser_unavailable'
  /** The executable exists, but the browser did not start. */
  | 'launch_failed'
  /** The document was refused before rendering (no content security policy). */
  | 'input_rejected'
  /** The browser started, but the page could not be turned into a PDF. */
  | 'render_failed';

/**
 * A failure of the PDF renderer. The message never quotes the document, so a log line cannot leak
 * the founder's text; `code` is the only thing a caller branches on.
 */
export class PdfRenderError extends Error {
  constructor(
    readonly code: PdfErrorCode,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = 'PdfRenderError';
  }
}
