import { chromium, expect, test } from '@playwright/test';
import {
  HOSTILE_EFFECT,
  PdfRenderError,
  buildPrintDocument,
  buildSpikeFixture,
  closeSharedBrowser,
  getSharedBrowser,
  renderPdf,
  type PrintLocale,
} from '@sbn/report';
import { foldForMatch, inspectPdf } from '@sbn/report/testing';

// The PDF renderer, end to end (M5 step 0, D-235, D-241). It needs no page, no web server of its
// own (the "site" project starts one anyway) and no Supabase: it renders the fixture with the
// Chromium that Playwright installed, which the pinned container has in CI, and reads the PDF
// back with pdf.js. PDF bytes are never compared: only pages, fonts and text.

test.beforeAll(() => {
  process.env.PDF_CHROMIUM_PATH = chromium.executablePath();
  // The pinned CI container runs as user 1001 without user namespaces, where Chromium cannot use
  // its sandbox (Playwright's own launcher drops it; Puppeteer's does not). Never set on Vercel.
  process.env.PDF_CHROMIUM_NO_SANDBOX = '1';
});

test.afterAll(async () => {
  await closeSharedBrowser();
});

const DIRECTION = { ar: 'rtl', en: 'ltr' } as const;

for (const locale of ['ar', 'en'] as const satisfies readonly PrintLocale[]) {
  test.describe(`the spike fixture as a PDF (${locale})`, () => {
    test('has the pages, the landscape page and the fonts', async () => {
      const fixture = await buildSpikeFixture(locale);
      const { pdf } = await renderPdf({
        html: fixture.html,
        locale,
        headerTitle: fixture.headerTitle,
      });
      const inspected = await inspectPdf(pdf, { direction: DIRECTION[locale] });

      expect(inspected.pages).toHaveLength(fixture.expected.pages);
      inspected.pages.forEach((page, index) => {
        expect(page.landscape, `page ${String(index + 1)}`).toBe(
          fixture.expected.landscapePages.includes(index + 1),
        );
      });
      // A4 in points: 595 x 842, turned over for the wide page.
      expect([inspected.pages[0]?.width, inspected.pages[0]?.height]).toEqual([595, 842]);
      expect([inspected.pages[4]?.width, inspected.pages[4]?.height]).toEqual([842, 595]);

      // Both families are embedded in the file, so no machine needs them installed.
      expect(inspected.fonts.some((name) => name.startsWith('Cairo'))).toBe(true);
      expect(inspected.fonts.some((name) => name.startsWith('Tajawal'))).toBe(true);
      expect(inspected.tagged).toBe(true);
    });

    test('holds the expected text in reading order, with Western digits', async () => {
      const fixture = await buildSpikeFixture(locale);
      const { pdf } = await renderPdf({
        html: fixture.html,
        locale,
        headerTitle: fixture.headerTitle,
      });
      const { text, pages } = await inspectPdf(pdf, { direction: DIRECTION[locale] });
      const folded = foldForMatch(text);

      for (const phrase of fixture.expected.phrases) {
        expect(folded, phrase).toContain(foldForMatch(phrase));
      }
      // Western digits everywhere (CLAUDE.md §6): no Arabic-Indic digit, even in the footer.
      expect(text).not.toMatch(/[\u0660-\u0669\u06F0-\u06F9]/);
      for (const [index, page] of pages.entries()) {
        expect(page.text, `page ${String(index + 1)}`).toContain(
          `${String(index + 1)} / ${String(pages.length)}`,
        );
      }
      // The running header names the report on every page.
      for (const page of pages)
        expect(foldForMatch(page.text)).toContain(foldForMatch(fixture.headerTitle));
    });

    test('is drawn with the joined forms of the Arabic letters', async () => {
      const fixture = await buildSpikeFixture(locale);
      const { pdf } = await renderPdf({
        html: fixture.html,
        locale,
        headerTitle: fixture.headerTitle,
      });
      const { pages } = await inspectPdf(pdf, { direction: DIRECTION[locale] });
      const stored = pages.map((page) => page.storedText).join('\n');
      // Shaping happened: the file holds the joined (presentation) forms of the letters.
      expect(/[\uFE70-\uFEFC]/.test(stored)).toBe(true);
      if (locale === 'ar') {
        // The lam-alef words of the fixture are drawn as the lam-alef ligature glyph (U+FEFB or
        // U+FEFC), and the tashkeel stays in the file as combining marks, not as lost text.
        expect(/[\uFEF5-\uFEFC]/.test(stored)).toBe(true);
        expect(/[\u064B-\u0652]/.test(stored) || /[\uFE70-\uFE7F]/.test(stored)).toBe(true);
      }
    });

    test('shows the hostile text as text: nothing is fetched and nothing runs', async () => {
      const fixture = await buildSpikeFixture(locale);
      const { pdf, aborted } = await renderPdf({
        html: fixture.html,
        locale,
        headerTitle: fixture.headerTitle,
      });
      const { text } = await inspectPdf(pdf, { direction: DIRECTION[locale] });

      // The document makes no request that is not a data: URL, so the filter aborts none.
      expect(aborted).toBe(fixture.expected.hostileResources);
      // The tags are on the page as characters, not as elements...
      expect(text).toContain('<img src="http://example.invalid/x"');
      expect(text).toContain('<script>');
      // ...and what the script and the onerror handler would have written is not there.
      expect(text).not.toContain(HOSTILE_EFFECT);
    });
  });
}

test.describe('the bookmarks (D-240)', () => {
  test('are made from the headings in English', async () => {
    const fixture = await buildSpikeFixture('en');
    const { pdf } = await renderPdf({ html: fixture.html, locale: 'en', headerTitle: 'x' });
    const { outline } = await inspectPdf(pdf, { direction: 'ltr' });
    expect(outline).toContain('Executive summary');
    expect(outline).toContain('Numbers and currencies');
  });

  test('are off for Arabic by default, because Chromium writes the words of a title reversed', async () => {
    const fixture = await buildSpikeFixture('ar');
    const { pdf } = await renderPdf({ html: fixture.html, locale: 'ar', headerTitle: 'x' });
    expect((await inspectPdf(pdf, { direction: 'rtl' })).outline).toEqual([]);
  });
});

test.describe('the layers around the document (D-235)', () => {
  const HOSTILE_PAGE =
    '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>t</title>' +
    '<link rel="stylesheet" href="http://example.invalid/s.css"></head><body><p>Hello</p>' +
    '<img src="http://example.invalid/a.png"><img src="http://example.invalid/b.png">' +
    '<script>document.body.append(String.fromCharCode(80,87,78))</script></body></html>';

  test('refuse a document without the content security policy tag', async () => {
    const error: unknown = await renderPdf({
      html: HOSTILE_PAGE,
      locale: 'en',
      headerTitle: 'x',
    }).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(PdfRenderError);
    expect(error).toMatchObject({ code: 'input_rejected' });
  });

  test('abort every request that is not a data: URL, and run no script, when the policy is missing', async () => {
    const { pdf, aborted } = await renderPdf({
      html: HOSTILE_PAGE,
      locale: 'en',
      headerTitle: 'x',
      requireCsp: false,
    });
    // One stylesheet and two images; the filter stops all three before they leave the machine.
    expect(aborted).toBe(3);
    const { text } = await inspectPdf(pdf, { direction: 'ltr' });
    expect(text).toContain('Hello');
    expect(text).not.toContain(HOSTILE_EFFECT);
  });

  test('block the same resources by policy before any request is made, and run no script', async () => {
    const html = await buildPrintDocument({
      locale: 'en',
      title: 't',
      body:
        '<p>Hello</p><img src="http://example.invalid/a.png"><img src="http://example.invalid/b.png">' +
        '<script>document.body.append(String.fromCharCode(80,87,78))</script>',
    });
    const { pdf, aborted } = await renderPdf({ html, locale: 'en', headerTitle: 'x' });
    // The policy refuses them first, so the filter has nothing left to abort.
    expect(aborted).toBe(0);
    const { text } = await inspectPdf(pdf, { direction: 'ltr' });
    expect(text).toContain('Hello');
    expect(text).not.toContain(HOSTILE_EFFECT);
  });

  test('reuse one browser, and start a new one after it is closed', async () => {
    const first = await getSharedBrowser();
    const second = await getSharedBrowser();
    expect(first.launched).toBe(true);
    expect(second.launched).toBe(false);
    expect(second.browser).toBe(first.browser);

    const html = await buildPrintDocument({ locale: 'en', title: 't', body: '<p>One</p>' });
    const { pdf } = await renderPdf({
      html,
      locale: 'en',
      headerTitle: 'x',
      browser: second.browser,
    });
    expect((await inspectPdf(pdf, { direction: 'ltr' })).pages).toHaveLength(1);
    // A reused browser stays open after a render.
    expect(second.browser.connected).toBe(true);

    await closeSharedBrowser();
    expect((await getSharedBrowser()).launched).toBe(true);
  });
});
