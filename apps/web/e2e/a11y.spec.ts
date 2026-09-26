import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

// Signed-in pages are checked in e2e/auth/a11y.spec.ts, which needs the local database.
const PAGES = [
  '/ar',
  '/en',
  '/ar/design',
  '/en/design',
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
