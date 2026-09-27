import { expect, test } from '@playwright/test';
import { PUBLIC_PAGES } from '../src/config/public-pages';

const LOCALES = ['ar', 'en'] as const;
const SCHEMES = ['light', 'dark'] as const;
const VIEWPORTS = {
  phone: { width: 360, height: 800 },
  desktop: { width: 1280, height: 900 },
} as const;
// The two layout-heavy pages are captured whole and at desktop width too; the others' opening
// screen on a phone is enough to catch header, breadcrumb and type regressions.
const FULL_PAGES = new Set(['home', 'pricing']);

test.describe('public page snapshots', () => {
  test.skip(
    !process.env.CI,
    'Baselines are generated and compared in the CI container only (D-055).',
  );

  for (const { id, path } of PUBLIC_PAGES) {
    const full = FULL_PAGES.has(id);
    const sizes: readonly (keyof typeof VIEWPORTS)[] = full ? ['phone', 'desktop'] : ['phone'];

    for (const locale of LOCALES) {
      for (const name of sizes) {
        for (const scheme of SCHEMES) {
          test(`${id} in ${locale} at ${name} width in ${scheme} theme`, async ({ page }) => {
            await page.setViewportSize(VIEWPORTS[name]);
            await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
            await page.goto(`/${locale}${path}`);
            await page.evaluate(() => document.fonts.ready);

            await expect(page).toHaveScreenshot(`${id}-${locale}-${name}-${scheme}.png`, {
              fullPage: full,
            });
          });
        }
      }
    }
  }
});
