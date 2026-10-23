import { expect, test } from '@playwright/test';

// The public sample report (D-293): the real report view over a frozen model of a fictional project,
// with no database and no account.
const WORDS = {
  ar: {
    heading: 'تقرير نموذجي',
    notice: 'عيّنة توضيحية لمشروع افتراضي',
    start: 'ابدأ تشخيص مشروعك مجانًا',
  },
  en: {
    heading: 'Sample report',
    notice: 'An illustrative sample for a fictional project',
    start: 'Start your diagnostic for free',
  },
} as const;

for (const locale of ['ar', 'en'] as const) {
  test.describe(`the ${locale} sample report`, () => {
    test('says what it is before it shows anything, and has one h1', async ({ page }) => {
      await page.goto(`/${locale}/sample-report`);
      const words = WORDS[locale];

      await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(words.heading);
      await expect(page.getByRole('note').first()).toContainText(words.notice);
      await expect(page.getByRole('link', { name: words.start }).first()).toHaveAttribute(
        'href',
        `/${locale}/signup`,
      );
    });

    test('draws the verdict slab and every section of a full report, none locked', async ({
      page,
    }) => {
      await page.goto(`/${locale}/sample-report`);

      await expect(page.locator('[data-verdict]')).toHaveCount(1);
      // The sections of the full report: a heading each, no lock note, no PDF button.
      expect(await page.locator('main h2, [id^="section-"] h2').count()).toBeGreaterThan(10);
      await expect(page.locator('[id^="section-"]')).toHaveCount(12);
      await expect(page.getByRole('button', { name: /PDF/ })).toHaveCount(0);
    });

    test('shows nothing made up for a fixture and no outside address', async ({ page }) => {
      await page.goto(`/${locale}/sample-report`);
      const text = (await page.locator('body').innerText()).toLowerCase();

      for (const marker of ['example.invalid', 'fixture', 'test note']) {
        expect(text, marker).not.toContain(marker);
      }
      const outside = await page.locator('main a[href^="http"]').count();
      expect(outside).toBe(0);
    });
  });
}

test.describe('on a phone', () => {
  test.use({ viewport: { width: 360, height: 800 } });

  test('the page does not scroll sideways', async ({ page }) => {
    await page.goto('/ar/sample-report');
    await page.evaluate(() => document.fonts.ready);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
