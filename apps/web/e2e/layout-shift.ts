import { expect, type Page } from '@playwright/test';

/**
 * Holds every font file back, so the page paints first with the fallback fonts and the real ones
 * swap in later, as on a slow connection. Without this the preloaded fonts are usually ready
 * before the first paint and a shift on swap is never measured (PERF-5).
 */
export async function delayFonts(page: Page, ms = 1_000): Promise<void> {
  await page.route(/\.woff2(\?|$)/, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, ms));
    await route.continue();
  });
}

/**
 * The layout shift of the page since it started loading, once its fonts are in: every shift not
 * caused by input, summed (stricter than CLS, which keeps the worst one-second window). Also
 * checks that the fonts arrived after the first paint, so the swap was really measured.
 */
export async function expectNoLayoutShift(page: Page): Promise<void> {
  const { shift, firstPaint, fontFiles, fontsArrived } = await page.evaluate(async () => {
    await document.fonts.ready;
    // Two frames, so the swapped text is laid out and its shift reported.
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const total = await new Promise<number>((resolve) => {
      let sum = 0;
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const layoutShift = entry as PerformanceEntry & {
            value: number;
            hadRecentInput: boolean;
          };
          if (!layoutShift.hadRecentInput) sum += layoutShift.value;
        }
      }).observe({ type: 'layout-shift', buffered: true });
      setTimeout(() => {
        resolve(sum);
      }, 500);
    });
    const fonts = performance
      .getEntriesByType('resource')
      .filter((entry) => entry.name.includes('.woff2')) as PerformanceResourceTiming[];
    return {
      shift: total,
      firstPaint:
        performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? Number.NaN,
      fontFiles: fonts.length,
      fontsArrived: Math.min(...fonts.map((entry) => entry.responseEnd)),
    };
  });

  expect(fontFiles, 'the page loads its fonts').toBeGreaterThan(0);
  expect(fontsArrived, 'the fonts arrive after the first paint').toBeGreaterThan(firstPaint);
  expect(shift).toBeLessThan(0.1);
}
