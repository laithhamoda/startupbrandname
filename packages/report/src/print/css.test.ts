import { describe, expect, it } from 'vitest';
import { PRINT_TOKENS, WIDE_PAGE_NAME, buildPrintCss } from './css';

// The same rules as scripts/check-logical-css.mjs, which only scans apps/web.
const PHYSICAL = [
  /(?<![\w-])(margin|padding|border|scroll-margin|scroll-padding)-(left|right)(?![\w-])/,
  /(?<![\w$.-])(left|right)\s*:/,
  /text-align\s*:\s*(left|right)/,
  /(float|clear)\s*:\s*(left|right)/,
];

describe('buildPrintCss', () => {
  for (const locale of ['ar', 'en'] as const) {
    const css = buildPrintCss(locale);

    it(`uses logical properties only (${locale})`, () => {
      for (const pattern of PHYSICAL) expect(css).not.toMatch(pattern);
    });

    it(`sets A4 portrait and a named landscape page for wide tables (${locale})`, () => {
      expect(css).toContain('@page{size:A4 portrait;');
      expect(css).toContain(`@page ${WIDE_PAGE_NAME}{size:A4 landscape;`);
      expect(css).toContain(`section.${WIDE_PAGE_NAME}{page:${WIDE_PAGE_NAME}}`);
    });

    it(`gives both page types the side margin of the running header (${locale})`, () => {
      // The header and footer templates have one inset for every page (18mm, template.ts), so the
      // landscape page needs the same side margin or its table edge would not line up with them.
      expect(css).toMatch(/@page\{size:A4 portrait;margin:\d+mm 18mm \d+mm\}/);
      expect(css).toMatch(
        new RegExp(`@page ${WIDE_PAGE_NAME}\\{size:A4 landscape;margin:\\d+mm 18mm \\d+mm\\}`),
      );
    });
  }

  it('builds the colours from the brand tokens', () => {
    const css = buildPrintCss('ar');
    for (const colour of ['#000000', '#D4A537', '#1FA3C7', '#8C6A12', '#0B6E8A']) {
      expect(css).toContain(colour);
    }
    expect(PRINT_TOKENS.black).toBe('#000000');
    expect(PRINT_TOKENS.gold).toBe('#D4A537');
    expect(PRINT_TOKENS.teal).toBe('#1FA3C7');
  });

  it('keeps gold for the verdict slab and key numbers, and teal off large surfaces', () => {
    const css = buildPrintCss('ar');
    expect(css).toMatch(/\.slab\{[^}]*color:var\(--gold\)/);
    expect(css).toMatch(/\.kpi \.value\{[^}]*color:var\(--gold-ink\)/);
    expect(css).not.toMatch(/background:var\(--teal\)/);
  });

  it('gives Arabic a taller line than English', () => {
    expect(buildPrintCss('ar')).toContain('line-height:1.9');
    expect(buildPrintCss('en')).toContain('line-height:1.6');
  });

  it('isolates digits, lines up numeric columns and breaks long lines', () => {
    const css = buildPrintCss('ar');
    expect(css).toContain('bdi{unicode-bidi:isolate}');
    expect(css).toMatch(/\.tbl \.num\{[^}]*direction:ltr;text-align:end;[^}]*tabular-nums/);
    expect(css).toContain('overflow-wrap:anywhere');
  });

  it('never leaves the direction to the stylesheet: dir comes from the html element', () => {
    expect(buildPrintCss('ar')).not.toMatch(/(^|[;{}\s])direction:rtl/);
  });
});
