import { expect, test } from '@playwright/test';

// Google itself cannot run in CI. These tests check both ends of the hand-over instead.

test('the Google button hands over to Supabase with PKCE and our callback', async ({ page }) => {
  await page.goto('/ar/login');
  const authorize = page.waitForRequest((request) => request.url().includes('/auth/v1/authorize'));

  await page.getByRole('button', { name: 'المتابعة باستخدام Google' }).click();

  const url = new URL((await authorize).url());
  expect(url.searchParams.get('provider')).toBe('google');
  expect(url.searchParams.get('code_challenge')).toBeTruthy();
  expect(url.searchParams.get('redirect_to')).toMatch(/\/auth\/callback\?next=%2Far%2Fprojects$/);
});

test('a failed Google sign-in comes back to the sign-in page with an explanation', async ({
  page,
}) => {
  await page.goto('/auth/callback?next=/en/projects');

  await expect(page).toHaveURL(/\/en\/login\?error=google$/);
  await expect(page.getByRole('alert')).toHaveText(/Signing in with Google did not complete/);
});

test('the callback never sends the user to another site', async ({ page }) => {
  await page.goto('/auth/callback?next=https://evil.example/ar');

  await expect(page).toHaveURL(/127\.0\.0\.1:3100\/ar\/login\?error=google$/);
});
