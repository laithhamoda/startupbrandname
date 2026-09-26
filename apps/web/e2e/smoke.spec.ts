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
