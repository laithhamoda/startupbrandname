import { expect, test } from '@playwright/test';
import { signInByEmail, signUpByEmail, uniqueEmail } from './helpers';

test('a returning user signs in with a new code', async ({ page }) => {
  // Supabase sends one code per address per minute, so this test waits out that minute.
  test.setTimeout(150_000);
  const email = uniqueEmail('returning');
  await signUpByEmail(page, email);
  await page.goto('/ar/account');
  await page.getByRole('button', { name: 'تسجيل الخروج' }).click();
  await expect(page).toHaveURL(/\/ar$/);

  await page.waitForTimeout(61_000);
  await signInByEmail(page, email);

  await expect(page).toHaveURL(/\/ar\/projects$/);
});

test('a signed-in user skips the sign-in and sign-up pages', async ({ page }) => {
  await signUpByEmail(page, uniqueEmail('signed-in'));

  await page.goto('/ar/login');
  await expect(page).toHaveURL(/\/ar\/projects$/);
  await page.goto('/ar/signup');
  await expect(page).toHaveURL(/\/ar\/projects$/);
});

test('signing out ends the session', async ({ page }) => {
  await signUpByEmail(page, uniqueEmail('sign-out'));
  await page.goto('/ar/account');

  await page.getByRole('button', { name: 'تسجيل الخروج' }).click();
  await expect(page).toHaveURL(/\/ar$/);
  await page.goto('/ar/projects');
  await expect(page).toHaveURL(/\/ar\/login$/);
});

test('a user withdraws consent, switches language and deletes the account', async ({ page }) => {
  await signUpByEmail(page, uniqueEmail('account'), true);
  await page.goto('/ar/account');

  await expect(page.getByText(/موافقتك مفعّلة/)).toBeVisible();
  await page.getByRole('button', { name: 'اسحب الموافقة' }).click();
  await expect(page.getByText(/موافقتك غير مفعّلة/)).toBeVisible();

  await page.getByLabel('اللغة').selectOption('en');
  await page.getByRole('button', { name: 'احفظ' }).click();
  await expect(page).toHaveURL(/\/en\/account$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('My account');

  await page.getByRole('button', { name: 'Delete my account' }).click();
  await page.getByRole('button', { name: 'Yes, delete my account' }).click();
  await expect(page).toHaveURL(/\/en\/goodbye$/);

  await page.goto('/en/projects');
  await expect(page).toHaveURL(/\/en\/login$/);
});
