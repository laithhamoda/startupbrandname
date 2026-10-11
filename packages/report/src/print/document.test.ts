import { describe, expect, it } from 'vitest';
import { PRINT_CSP, PRINT_CSP_META } from './csp';
import { buildPrintDocument, isolatedLatin, isolatedNumber } from './document';

const FONT_CSS = '/* test fonts */';

describe('buildPrintDocument', () => {
  it('sets lang and dir on the root from the locale', async () => {
    const ar = await buildPrintDocument({ locale: 'ar', title: 't', body: '', fontCss: FONT_CSS });
    const en = await buildPrintDocument({ locale: 'en', title: 't', body: '', fontCss: FONT_CSS });
    expect(ar).toContain('<html lang="ar" dir="rtl">');
    expect(en).toContain('<html lang="en" dir="ltr">');
  });

  it('puts the content security policy before the title and the styles', async () => {
    const html = await buildPrintDocument({
      locale: 'en',
      title: 'Report',
      body: '<p>x</p>',
      fontCss: FONT_CSS,
    });
    const policy = html.indexOf(PRINT_CSP_META);
    expect(policy).toBeGreaterThan(-1);
    expect(policy).toBeLessThan(html.indexOf('<title>'));
    expect(policy).toBeLessThan(html.indexOf('<style>'));
  });

  it('forbids every fetch, scripts and frames included', () => {
    expect(PRINT_CSP).toBe(
      "default-src 'none'; style-src 'unsafe-inline'; font-src data:; img-src data:",
    );
    expect(PRINT_CSP).not.toMatch(/script-src/);
  });

  it('escapes the title', async () => {
    const html = await buildPrintDocument({
      locale: 'en',
      title: '</title><script>x</script>',
      body: '',
      fontCss: FONT_CSS,
    });
    expect(html).toContain('<title>&lt;/title&gt;&lt;script&gt;x&lt;/script&gt;</title>');
    expect(html).not.toContain('<script>');
  });

  it('inlines the fonts and the stylesheet, and puts the body in the body', async () => {
    const html = await buildPrintDocument({
      locale: 'ar',
      title: 't',
      body: '<p>مرحبا</p>',
      fontCss: FONT_CSS,
    });
    expect(html).toContain(`<style>${FONT_CSS}\n`);
    expect(html).toContain('@page{size:A4 portrait');
    expect(html).toContain('<body><p>مرحبا</p></body>');
    expect(html).toContain('<meta charset="utf-8">');
  });

  it('loads the print fonts when none are given', async () => {
    const html = await buildPrintDocument({ locale: 'ar', title: 't', body: '' });
    expect(html).toContain("font-family:'Cairo'");
    expect(html).toContain("font-family:'Tajawal'");
  });
});

describe('isolated fragments', () => {
  it('wraps a number in a bidi isolate and escapes it', () => {
    expect(isolatedNumber('-1,500')).toBe('<bdi>-1,500</bdi>');
    expect(isolatedNumber('<b>')).toBe('<bdi>&lt;b&gt;</bdi>');
  });

  it('wraps a left-to-right fragment with its direction fixed', () => {
    expect(isolatedLatin('LTV/CAC')).toBe('<bdi dir="ltr">LTV/CAC</bdi>');
    expect(isolatedLatin('a&b')).toBe('<bdi dir="ltr">a&amp;b</bdi>');
  });
});
