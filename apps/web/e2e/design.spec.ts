import { expect, test } from '@playwright/test';

const VIEWPORTS = [
  { name: 'phone', width: 360, height: 800 },
  { name: 'desktop', width: 1280, height: 900 },
] as const;
const SCHEMES = ['light', 'dark'] as const;

// RTL visual snapshots of the component gallery (M1 definition of done).
test.describe('design system snapshots', () => {
  test.skip(
    !process.env.CI,
    'Baselines are generated and compared in the CI container only (D-055).',
  );

  for (const viewport of VIEWPORTS) {
    for (const scheme of SCHEMES) {
      test(`gallery at ${viewport.name} width in ${scheme} theme`, async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
        await page.goto('/design');
        await page.evaluate(() => document.fonts.ready);

        await expect(page).toHaveScreenshot(`gallery-${viewport.name}-${scheme}.png`, {
          fullPage: true,
        });
      });
    }
  }
});
