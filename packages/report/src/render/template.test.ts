import { describe, expect, it } from 'vitest';
import { footerTemplate, headerTemplate } from './template';

const fontCss = '/* tajawal */';

describe('running header and footer', () => {
  it('shows the title in the header, escaped, in the direction of the document', () => {
    const ar = headerTemplate({ locale: 'ar', title: 'تقرير <b>', fontCss });
    expect(ar).toContain('dir="rtl" lang="ar"');
    expect(ar).toContain('<span>تقرير &lt;b&gt;</span>');
    expect(ar).not.toContain('<b>');
    expect(headerTemplate({ locale: 'en', title: 'Report', fontCss })).toContain(
      'dir="ltr" lang="en"',
    );
  });

  it('carries its own fonts, because Chromium draws it outside the page', () => {
    expect(headerTemplate({ locale: 'ar', title: 't', fontCss })).toContain(
      `<style>${fontCss}</style>`,
    );
    expect(footerTemplate({ locale: 'ar', fontCss })).toContain(`<style>${fontCss}</style>`);
  });

  it('shows the page number and the count in an isolate, in that order', () => {
    const footer = footerTemplate({ locale: 'ar', fontCss });
    expect(footer).toContain(
      '<bdi dir="ltr"><span class="pageNumber"></span> / <span class="totalPages"></span></bdi>',
    );
  });

  it('uses logical properties and a visible size in points', () => {
    for (const html of [
      headerTemplate({ locale: 'ar', title: 't', fontCss }),
      footerTemplate({ locale: 'ar', fontCss }),
    ]) {
      expect(html).toContain('font-size:8pt');
      expect(html).toContain('padding-inline:18mm');
      expect(html).not.toMatch(
        /(margin|padding|border)-(left|right)|text-align\s*:\s*(left|right)/,
      );
    }
  });
});
