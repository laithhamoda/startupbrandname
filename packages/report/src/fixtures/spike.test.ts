import { describe, expect, it } from 'vitest';
import { PRINT_CSP_META } from '../print/csp';
import { HOSTILE_EFFECT, HOSTILE_TEXT, buildSpikeFixture } from './spike';

// A stand-in for the font data keeps these tests fast; the fonts have their own tests.
const options = { fontCss: '/* fonts */' };

describe('the spike fixture', () => {
  it('is Arabic right-to-left and English left-to-right, with the same six sections', async () => {
    const ar = await buildSpikeFixture('ar', options);
    const en = await buildSpikeFixture('en', options);
    expect(ar.html).toContain('<html lang="ar" dir="rtl">');
    expect(en.html).toContain('<html lang="en" dir="ltr">');
    for (const fixture of [ar, en]) {
      expect(fixture.html.match(/<section class="page/g)).toHaveLength(6);
      expect(fixture.expected.pages).toBeGreaterThanOrEqual(6);
      expect(fixture.expected.pages).toBe(6);
      expect(fixture.expected.landscapePages).toEqual([5]);
    }
  });

  it('puts the landscape page fifth, on the named wide page', async () => {
    const { html } = await buildSpikeFixture('ar', options);
    const sections = html.split('<section ').slice(1);
    expect(sections[4]).toMatch(/^class="page wide"/);
    expect(sections.filter((section) => section.startsWith('class="page wide"'))).toHaveLength(1);
  });

  it('has the policy tag and refers to nothing outside the document', async () => {
    for (const locale of ['ar', 'en'] as const) {
      const { html } = await buildSpikeFixture(locale, options);
      expect(html).toContain(PRINT_CSP_META);
      expect(html).not.toMatch(/<(img|script|link|iframe|object|embed|base|form)\b/i);
      // A tag of the document (a raw "<") never carries an address or an event handler; the
      // hostile text mentions both, but escaped, so it has no raw "<" at all.
      expect(html).not.toMatch(/<[a-z][^>]*\s(src|href|action|srcset)\s*=/i);
      expect(html).not.toMatch(/<[a-z][^>]*\son[a-z]+\s*=/i);
    }
  });

  it('shows the hostile text as escaped text, never as markup', async () => {
    for (const locale of ['ar', 'en'] as const) {
      const { html } = await buildSpikeFixture(locale, options);
      expect(HOSTILE_TEXT).toContain('<img src="http://example.invalid/x"');
      expect(html).toContain('&lt;img src=&quot;http://example.invalid/x&quot; onerror=');
      expect(html).toContain('&lt;script&gt;');
      // The effect the script would have had is never written out as a word.
      expect(html).not.toContain(HOSTILE_EFFECT);
    }
  });

  it('writes numbers in Western digits inside bidi isolates, with the currency after them', async () => {
    const ar = (await buildSpikeFixture('ar', options)).html;
    expect(ar).toContain('<bdi>250</bdi> د.أ');
    expect(ar).toContain('<bdi>-1,500</bdi> د.أ');
    expect(ar).toContain('<bdi>83,333.33</bdi>');
    expect(ar).toContain('<bdi>42.5%</bdi>');
    expect(ar).not.toMatch(/[\u0660-\u0669\u06F0-\u06F9]/);
    const en = (await buildSpikeFixture('en', options)).html;
    expect(en).toContain('<bdi>250</bdi> JOD');
    expect(en).toContain('<bdi>-1,500</bdi> JOD');
  });

  it('holds Arabic terms with English in parentheses, and the mixed fragments', async () => {
    const { html } = await buildSpikeFixture('ar', options);
    expect(html).toContain('نقطة التعادل (Break-even)');
    expect(html).toContain('<bdi dir="ltr">LTV/CAC</bdi>');
    expect(html).toContain('<bdi dir="ltr">M5</bdi>');
    expect(html).toContain('<bdi dir="ltr">https://startupbrandname.com/report</bdi>');
  });

  it('closes the verdict slab with one of the three verdicts of CLAUDE.md', async () => {
    const { html } = await buildSpikeFixture('ar', options);
    expect(html).toMatch(/<div class="verdict">(امضِ|عدّل|توقّف)<\/div>/);
  });

  it('lists the phrases a PDF must hold, per language, and no hostile resource', async () => {
    const ar = await buildSpikeFixture('ar', options);
    const en = await buildSpikeFixture('en', options);
    expect(ar.expected.phrases).toContain('الملخّص التنفيذي');
    expect(en.expected.phrases).toContain('Executive summary');
    expect(ar.expected.hostileResources).toBe(0);
    expect(en.expected.hostileResources).toBe(0);
    expect(ar.headerTitle).not.toBe('');
  });
});
