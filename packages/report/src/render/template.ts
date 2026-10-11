import { escapeHtml } from '../print/escape';
import { directionOf, type PrintLocale } from '../print/locale';

/**
 * The running header and footer. Chromium draws them in its own context, outside the page: the
 * page stylesheet and fonts do not reach them, so each carries the one font it needs (Tajawal 400,
 * Arabic and Latin) and the sizes in points. The page number and the count are filled by Chromium
 * through the pageNumber and totalPages classes; the isolate keeps "3 / 6" in that order in
 * right-to-left text, in Western digits.
 */

const BASE =
  "font-family:'Tajawal',sans-serif;font-size:8pt;line-height:1.4;color:#4D4D4D;" +
  'inline-size:100%;padding-inline:18mm;margin:0;-webkit-print-color-adjust:exact';

export function headerTemplate(input: {
  locale: PrintLocale;
  title: string;
  fontCss: string;
}): string {
  const { locale, title, fontCss } = input;
  return (
    `<style>${fontCss}</style>` +
    `<div dir="${directionOf(locale)}" lang="${locale}" style="${BASE};` +
    `display:flex;justify-content:space-between;padding-block-end:3pt">` +
    `<span>${escapeHtml(title)}</span></div>`
  );
}

export function footerTemplate(input: { locale: PrintLocale; fontCss: string }): string {
  const { locale, fontCss } = input;
  return (
    `<style>${fontCss}</style>` +
    `<div dir="${directionOf(locale)}" lang="${locale}" style="${BASE};` +
    `display:flex;justify-content:flex-end">` +
    `<bdi dir="ltr"><span class="pageNumber"></span> / <span class="totalPages"></span></bdi></div>`
  );
}
