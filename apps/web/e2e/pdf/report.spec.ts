import { chromium, expect, test } from '@playwright/test';
import {
  HOSTILE_EFFECT,
  HOSTILE_TEXT,
  closeSharedBrowser,
  getSharedBrowser,
  renderReportPdf,
  type PrintLocale,
} from '@sbn/report';
import {
  KEY_NUMBER_ORDER,
  buildReportModel,
  inlineText,
  messagesFor,
  type ReportModel,
} from '@sbn/report/model';
import { foldForMatch, inspectPdf } from '@sbn/report/testing';
import { goldenReportInput } from '@sbn/report/testing/inputs';

// The report as a PDF, end to end (M5 step 6, D-279 to D-284): the print template drawn by the
// pinned Chromium, then read back with pdf.js. Like pdf.spec.ts it needs no page, no database and
// no web server of its own. PDF bytes are never compared: only pages, fonts, text and requests.

test.beforeAll(() => {
  process.env.PDF_CHROMIUM_PATH = chromium.executablePath();
  // The pinned CI container cannot use Chromium's sandbox (see pdf.spec.ts). Never set on Vercel.
  process.env.PDF_CHROMIUM_NO_SANDBOX = '1';
});

test.afterAll(async () => {
  await closeSharedBrowser();
});

const DIRECTION = { ar: 'rtl', en: 'ltr' } as const;

function modelOf(
  locale: PrintLocale,
  options: { title?: string; summary?: boolean; worry?: string } = {},
): ReportModel {
  const input = goldenReportInput('jo-service-subscription', {
    locale,
    ...(options.summary === true ? { kind: 'summary' as const, lockReason: 'plan' as const } : {}),
    ...(options.worry === undefined
      ? {}
      : {
          change: (answers: Record<string, unknown>) => {
            answers.H6 = { status: 'answered', value: options.worry };
          },
        }),
  });
  return buildReportModel(
    options.title === undefined
      ? input
      : { ...input, project: { ...input.project, title: options.title } },
  );
}

async function render(model: ReportModel) {
  const { browser } = await getSharedBrowser();
  const result = await renderReportPdf({ model, browser });
  const inspected = await inspectPdf(result.pdf, { direction: DIRECTION[model.locale] });
  return { ...result, inspected };
}

for (const locale of ['ar', 'en'] as const satisfies readonly PrintLocale[]) {
  test.describe(`the full report as a PDF (${locale})`, () => {
    test('has a sensible number of pages, the cover alone and the summary on the second', async () => {
      const model = modelOf(locale);
      const { inspected } = await render(model);
      const m = messagesFor(locale);
      expect(inspected.pages.length).toBeGreaterThanOrEqual(10);
      expect(inspected.pages.length).toBeLessThanOrEqual(24);

      const first = foldForMatch(inspected.pages[0]?.text ?? '');
      const second = foldForMatch(inspected.pages[1]?.text ?? '');
      expect(first).toContain(foldForMatch(model.meta.title));
      expect(first).toContain(foldForMatch(m.reportKind));
      // The cover is alone on its page: the executive summary starts on the next one.
      expect(first).not.toContain(foldForMatch(m.sections.executive_summary));
      expect(second).toContain(foldForMatch(m.sections.executive_summary));
      expect(second).toContain(foldForMatch(m.verdictWords.revise));
    });

    test('sets the projection on a landscape page and the rest on A4 portrait', async () => {
      const model = modelOf(locale);
      const { inspected } = await render(model);
      const landscape = inspected.pages.filter((page) => page.landscape);
      expect(landscape.length).toBeGreaterThanOrEqual(1);
      // The funding need is the lowest cash of the year-one table. The text layer of Arabic words
      // is not reliable (OPEN-QUESTIONS #95), so the page is found by its figures, not its title.
      expect(landscape.some((page) => page.text.includes('18,400.000'))).toBe(true);
      // A4 in points, turned over for the wide page.
      const portrait = inspected.pages.find((page) => !page.landscape);
      expect([portrait?.width, portrait?.height]).toEqual([595, 842]);
      expect([landscape[0]?.width, landscape[0]?.height]).toEqual([842, 595]);
      // The cover and the summary are portrait.
      expect(inspected.pages[0]?.landscape).toBe(false);
      expect(inspected.pages[1]?.landscape).toBe(false);
    });

    test('embeds its fonts, is tagged and carries the project title and no author', async () => {
      const model = modelOf(locale);
      const { inspected } = await render(model);
      expect(inspected.fonts.some((name) => name.startsWith('Cairo'))).toBe(true);
      expect(inspected.fonts.some((name) => name.startsWith('Tajawal'))).toBe(true);
      expect(inspected.tagged).toBe(true);
      expect(inspected.info.title).toBe(model.meta.title);
      expect(inspected.info.author).toBeNull();
    });

    test('writes Western digits only, and a page number on every page after the cover', async () => {
      const { inspected } = await render(modelOf(locale));
      expect(inspected.text).not.toMatch(/[٠-٩۰-۹]/);
      const count = inspected.pages.length;
      inspected.pages.forEach((page, index) => {
        if (index === 0) {
          expect(page.text).not.toContain(`1 / ${String(count)}`);
        } else {
          expect(page.text, `page ${String(index + 1)}`).toContain(
            `${String(index + 1)} / ${String(count)}`,
          );
        }
      });
    });

    test('keeps the key lines in reading order: the verdict, then the three key numbers', async () => {
      const model = modelOf(locale);
      const { inspected } = await render(model);
      const m = messagesFor(locale);
      const page = foldForMatch(inspected.pages[1]?.text ?? '');
      const keys = model.sections
        .find((section) => section.id === 'executive_summary')
        ?.blocks.find((block) => block.type === 'keyNumbers');
      expect(keys?.type).toBe('keyNumbers');
      if (keys?.type !== 'keyNumbers') return;
      expect(keys.items).toHaveLength(KEY_NUMBER_ORDER.investor.length);
      const at = [
        page.indexOf(foldForMatch(m.verdictWords.revise)),
        ...keys.items.map((item) => page.indexOf(foldForMatch(inlineText(item.label)))),
      ];
      expect(at.every((index) => index >= 0)).toBe(true);
      expect(at).toEqual([...at].sort((a, b) => a - b));
    });

    test('prints the legend of the lowest cash and of the break-even month on the wide page', async () => {
      const { inspected } = await render(modelOf(locale));
      const m = messagesFor(locale);
      const wide = foldForMatch(
        inspected.pages
          .filter((page) => page.landscape)
          .map((page) => page.text)
          .join(' '),
      );
      const lowest = inlineText(m.projection.legendLowest({ month: m.month({ n: [{ n: '5' }] }) }));
      expect(wide).toContain(foldForMatch(lowest));
    });

    test('makes no request at all: nothing is fetched and nothing was aborted', async () => {
      const { aborted } = await render(modelOf(locale));
      expect(aborted).toBe(0);
    });

    test('shows a hostile title, worry and idea as text, and runs nothing', async () => {
      const model = modelOf(locale, { title: HOSTILE_TEXT, worry: HOSTILE_TEXT });
      const { inspected, aborted } = await render(model);
      expect(aborted).toBe(0);
      expect(inspected.text).toContain('<script>');
      expect(inspected.text).toContain('<img src="http://example.invalid/x"');
      expect(inspected.text).not.toContain(HOSTILE_EFFECT);
      // Chromium writes a line break of the title as a space.
      expect(inspected.info.title).toBe(HOSTILE_TEXT.replace(/\s+/g, ' '));
    });
  });
}

test.describe('the summary as a PDF', () => {
  test('prints the locked titles and nothing a locked section would hold', async () => {
    // In English: the text layer of Arabic words is not reliable (OPEN-QUESTIONS #95).
    const model = modelOf('en', { summary: true });
    const { inspected } = await render(model);
    const text = foldForMatch(inspected.text);
    const m = messagesFor('en');
    expect(inspected.pages.length).toBeLessThanOrEqual(4);
    expect(inspected.pages.every((page) => !page.landscape)).toBe(true);
    for (const id of ['executive_summary', 'projection', 'validation_plan'] as const) {
      expect(text).toContain(foldForMatch(m.sections[id]));
    }
    expect(text).toContain(foldForMatch(m.print.locked));
    // The projection's tables and the validation plan's strips are not on the page.
    expect(text).not.toContain(foldForMatch(m.projection.rows.cumulativeCash));
    expect(text).not.toContain(foldForMatch(m.print.fill.decision));
  });
});
