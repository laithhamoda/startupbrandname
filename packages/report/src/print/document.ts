import { PRINT_CSP_META } from './csp';
import { buildPrintCss } from './css';
import { escapeHtml } from './escape';
import { loadFontFaceCss } from './fonts';
import { directionOf, type PrintLocale } from './locale';

export interface PrintDocumentInput {
  locale: PrintLocale;
  /** The document title (plain text; escaped here). */
  title: string;
  /** The body markup. Built by the templates from escaped text only (D-235). */
  body: string;
  /** Defaults to the print set; a test passes its own to avoid reading the font files. */
  fontCss?: string;
}

/**
 * A whole print document: the policy first, then the title, the inlined fonts and the stylesheet.
 * `lang` and `dir` are set on the root, once, from the locale.
 */
export async function buildPrintDocument(input: PrintDocumentInput): Promise<string> {
  const { locale, title, body } = input;
  const fontCss = input.fontCss ?? (await loadFontFaceCss());
  return [
    '<!doctype html>',
    `<html lang="${locale}" dir="${directionOf(locale)}">`,
    '<head>',
    '<meta charset="utf-8">',
    PRINT_CSP_META,
    `<title>${escapeHtml(title)}</title>`,
    `<style>${fontCss}\n${buildPrintCss(locale)}</style>`,
    '</head>',
    `<body>${body}</body>`,
    '</html>',
  ].join('\n');
}

/**
 * A number for a document: Western digits (CLAUDE.md §6) in a bidi isolate, so the digits, the
 * sign and the separators keep their order inside right-to-left text. The value is escaped like
 * any other text.
 */
export function isolatedNumber(value: string): string {
  return `<bdi>${escapeHtml(value)}</bdi>`;
}

/** A left-to-right fragment inside the text (a URL, `LTV/CAC`, a code): isolated, escaped. */
export function isolatedLatin(value: string): string {
  return `<bdi dir="ltr">${escapeHtml(value)}</bdi>`;
}
