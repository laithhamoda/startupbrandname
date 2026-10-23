import { expect, test } from '@playwright/test';

test('the Arabic home page is right-to-left', async ({ page }) => {
  await page.goto('/ar');

  const html = page.locator('html');
  await expect(html).toHaveAttribute('lang', 'ar');
  await expect(html).toHaveAttribute('dir', 'rtl');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});

test('the English home page is left-to-right', async ({ page }) => {
  await page.goto('/en');

  const html = page.locator('html');
  await expect(html).toHaveAttribute('lang', 'en');
  await expect(html).toHaveAttribute('dir', 'ltr');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/business model/i);
});

test.describe('the root redirects an Arabic browser', () => {
  test.use({ locale: 'ar-JO' });

  test('to /ar', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/ar$/);
  });
});

test.describe('the root redirects an English browser', () => {
  test.use({ locale: 'en-US' });

  test('to /en', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/en$/);
  });
});

test('paths without a language prefix keep working', async ({ page }) => {
  await page.goto('/design');
  await expect(page).toHaveURL(/\/ar\/design$/);
});

test('the language switch opens the same page in the other language', async ({ page }) => {
  await page.goto('/ar/design');
  await page.getByRole('link', { name: 'English' }).click();

  await expect(page).toHaveURL(/\/en\/design$/);
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');

  await page.getByRole('link', { name: 'العربية' }).click();
  await expect(page).toHaveURL(/\/ar\/design$/);
});

test('an unknown page answers 404 in its own language', async ({ page }) => {
  const response = await page.goto('/en/no-such-page');

  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Page not found');
});

test('a missing file outside the language routes answers 404', async ({ request }) => {
  const response = await request.get('/missing-file.txt');

  expect(response.status()).toBe(404);
});

// The icons of the brand kit (D-289): each page names them, none is redirected by the language
// routing, and each one is served.
for (const locale of ['ar', 'en'] as const) {
  test(`the ${locale} home page declares its icons and the manifest, and all are served`, async ({
    page,
    request,
  }) => {
    await page.goto(`/${locale}`);
    const hrefs = await page
      .locator(
        'head link[rel~="icon"], head link[rel="apple-touch-icon"], head link[rel="manifest"]',
      )
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('href') ?? ''));
    const paths = hrefs.map((href) => new URL(href, 'http://site.test').pathname);
    expect(paths).toEqual(
      expect.arrayContaining([
        '/favicon.ico',
        '/icon.svg',
        '/apple-touch-icon.png',
        '/manifest.webmanifest',
      ]),
    );

    for (const path of paths) {
      const response = await request.get(path, { maxRedirects: 0 });
      expect(response.status(), path).toBe(200);
    }
    const manifest = (await (await request.get('/manifest.webmanifest')).json()) as {
      icons: { src: string }[];
    };
    for (const icon of manifest.icons) {
      expect((await request.get(icon.src, { maxRedirects: 0 })).status(), icon.src).toBe(200);
    }
  });
}
