import { expect, test } from '@playwright/test';

const LOCALES = ['ar', 'en'] as const;
const VIEWPORTS = [
  { name: 'phone', width: 360, height: 800 },
  { name: 'desktop', width: 1280, height: 900 },
] as const;
const SCHEMES = ['light', 'dark'] as const;

// Visual snapshots of the component gallery, right-to-left and left-to-right (M1, D-067).
test.describe('design system snapshots', () => {
  test.skip(
    !process.env.CI,
    'Baselines are generated and compared in the CI container only (D-055).',
  );

  for (const locale of LOCALES) {
    for (const viewport of VIEWPORTS) {
      for (const scheme of SCHEMES) {
        test(`${locale} gallery at ${viewport.name} width in ${scheme} theme`, async ({ page }) => {
          await page.setViewportSize({ width: viewport.width, height: viewport.height });
          await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
          await page.goto(`/${locale}/design`);
          await page.evaluate(() => document.fonts.ready);

          await expect(page).toHaveScreenshot(`gallery-${locale}-${viewport.name}-${scheme}.png`, {
            fullPage: true,
          });
        });
      }
    }
  }
});
