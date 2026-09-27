import { fileURLToPath } from 'node:url';
import { test } from '@playwright/test';
import { ogImageName, PUBLIC_PAGES } from '../src/config/public-pages';

// Writes the share images (Open Graph) into public/og. Run with `pnpm og:images` after a build,
// then commit the files. Not part of the normal test run (project "og" in playwright.config.ts).
const OUTPUT = fileURLToPath(new URL('../public/og/', import.meta.url));

for (const locale of ['ar', 'en'] as const) {
  for (const { id } of PUBLIC_PAGES) {
    const name = ogImageName(id);
    test(`share image ${locale}/${name}`, async ({ page }) => {
      await page.setViewportSize({ width: 1200, height: 630 });
      await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
      await page.goto(`/${locale}/og-card/${name.replace(/\.png$/, '')}`);
      await page.evaluate(() => document.fonts.ready);

      await page.locator('[data-og-card]').screenshot({ path: `${OUTPUT}${locale}/${name}` });
    });
  }
}
