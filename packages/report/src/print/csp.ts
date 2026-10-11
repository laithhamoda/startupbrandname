/**
 * The content security policy of every print document (D-235): nothing may be fetched. Styles are
 * inline, fonts and images are data: URLs, scripts and frames are not allowed at all. The same
 * rules hold on a second layer: JavaScript is turned off and every request that is not a data: URL
 * is aborted (render/pdf.ts).
 */
export const PRINT_CSP =
  "default-src 'none'; style-src 'unsafe-inline'; font-src data:; img-src data:";

/** The tag that goes first in the head, before anything that could load a resource. */
export const PRINT_CSP_META = `<meta http-equiv="Content-Security-Policy" content="${PRINT_CSP}">`;
