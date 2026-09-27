import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { PUBLIC_PAGES } from '../src/config/public-pages';

// Signed-in pages are checked in e2e/auth/a11y.spec.ts, which needs the local database.
const PAGES = [
  ...PUBLIC_PAGES.flatMap(({ path }) => [`/ar${path}`, `/en${path}`]),
  '/ar/design',
  '/en/design',
  '/ar/design/diagnostic',
  '/en/design/diagnostic',
  '/ar/signup',
  '/en/signup',
  '/ar/login',
  '/en/login',
  '/ar/privacy',
  '/en/terms',
] as const;
const SCHEMES = ['light', 'dark'] as const;
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

// WCAG 2.2 AA is an acceptance criterion, not polish (CLAUDE.md §4 rule 11).
for (const path of PAGES) {
  for (const scheme of SCHEMES) {
    test(`${path} has no WCAG 2.2 AA violations in ${scheme} theme`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto(path);
      await page.evaluate(() => document.fonts.ready);

      const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();

      expect(results.violations.map((violation) => `${violation.id}: ${violation.help}`)).toEqual(
        [],
      );
    });
  }
}

test.describe('on a phone', () => {
  test.use({ viewport: { width: 360, height: 800 } });

  for (const path of ['/ar', '/en/pricing']) {
    test(`${path} with the menu open has no WCAG 2.2 AA violations`, async ({ page }) => {
      await page.goto(path);
      await page.evaluate(() => document.fonts.ready);
      await page.getByRole('button', { name: /القائمة|Menu/ }).click();

      const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();

      expect(results.violations.map((violation) => `${violation.id}: ${violation.help}`)).toEqual(
        [],
      );
    });
  }
});
