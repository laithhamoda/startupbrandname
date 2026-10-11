/**
 * Escapes the five characters that can open or close markup, in text and in quoted attributes.
 * Every template function of the report passes every founder-controlled string through here and
 * never builds markup from raw text (D-235): the PDF is made from this escaped text only.
 */
export function escapeHtml(text: string): string {
  // The ampersand goes first, so the entities written below are not escaped again.
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
