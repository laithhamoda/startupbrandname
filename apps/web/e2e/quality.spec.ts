import { expect, test } from '@playwright/test';
import { delayFonts, expectNoLayoutShift } from './layout-shift';

const SKIP_LINK = { ar: 'تخطَّ إلى المحتوى', en: 'Skip to content' } as const;

for (const [locale, name] of Object.entries(SKIP_LINK)) {
  test(`keyboard users can skip to the content with a visible focus ring (${locale})`, async ({
    page,
  }) => {
    await page.goto(`/${locale}`);
    await page.keyboard.press('Tab');

    const skipLink = page.getByRole('link', { name });
    await expect(skipLink).toBeFocused();
    await expect(skipLink).toBeInViewport();
    const outline = await skipLink.evaluate((element) => getComputedStyle(element).outlineStyle);
    expect(outline).not.toBe('none');
  });
}

// The fonts arrive after the first paint, as on a slow connection, so the swap is measured
// (PERF-5). A diagnostic step is measured in e2e/auth/layout-shift.spec.ts.
for (const locale of ['ar', 'en'] as const) {
  test(`fonts swap in without layout shift (${locale})`, async ({ page }) => {
    await delayFonts(page);
    await page.goto(`/${locale}`);

    await expectNoLayoutShift(page);
  });
}

test('the theme toggle cycles automatic, light and dark', async ({ page }) => {
  await page.goto('/ar');
  const html = page.locator('html');
  const toggle = page.getByRole('button', { name: /المظهر/ });

  await expect(html).not.toHaveAttribute('data-theme');
  await toggle.click();
  await expect(html).toHaveAttribute('data-theme', 'light');
  await toggle.click();
  await expect(html).toHaveAttribute('data-theme', 'dark');
  await toggle.click();
  await expect(html).not.toHaveAttribute('data-theme');
});

test('pages stay out of search indexes until public launch', async ({ page, request }) => {
  const response = await page.goto('/ar');

  expect(response?.headers()['x-robots-tag']).toBe('noindex, nofollow');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);

  const robots = await (await request.get('/robots.txt')).text();
  expect(robots).toMatch(/Disallow: \//);
});

test('pages and files send the baseline browser security headers', async ({ page, request }) => {
  for (const response of [await page.goto('/ar'), await request.get('/robots.txt')]) {
    const headers = response?.headers() ?? {};
    expect(headers['x-frame-options']).toBe('DENY');
    expect(headers['content-security-policy']).toBe("frame-ancestors 'none'");
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(headers['permissions-policy']).toBe('camera=(), microphone=(), geolocation=()');
    expect(headers['strict-transport-security']).toBe('max-age=63072000');
  }
});

test('each language version links to the other with hreflang', async ({ page }) => {
  await page.goto('/en');

  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/en$/);
  await expect(page.locator('link[rel="alternate"][hreflang="ar"]')).toHaveAttribute(
    'href',
    /\/ar$/,
  );
  await expect(page.locator('link[rel="alternate"][hreflang="x-default"]')).toHaveAttribute(
    'href',
    /startupbrandname\.com\/?$/,
  );
});

test('the site publishes organisation and website structured data', async ({ page }) => {
  await page.goto('/ar');

  const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
  const types = blocks.map((block) => (JSON.parse(block) as { '@type': string })['@type']);

  expect(types).toEqual(expect.arrayContaining(['Organization', 'WebSite']));
});
