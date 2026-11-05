import { expect, test } from '@playwright/test';
import {
  answerAboutYou,
  countEmails,
  readCode,
  signInByEmail,
  signUpByEmail,
  uniqueEmail,
} from './helpers';

test('a returning user signs in with a new code', async ({ page }) => {
  // Supabase sends one code per address per minute (D-084), so this test waits out that minute.
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

test('a user withdraws consent and deletes the account', async ({ page }) => {
  const email = uniqueEmail('account');
  await signUpByEmail(page, email, true);
  await page.goto('/ar/account');

  await expect(page.getByText(/موافقتك مفعّلة/)).toBeVisible();
  await page.getByRole('button', { name: 'اسحب الموافقة' }).click();
  await expect(page.getByText(/موافقتك غير مفعّلة/)).toBeVisible();

  await page.getByRole('button', { name: 'احذف حسابي' }).click();
  await page.getByRole('button', { name: 'نعم، احذف حسابي' }).click();
  await expect(page).toHaveURL(/\/ar\/goodbye$/);

  await page.goto('/ar/projects');
  await expect(page).toHaveURL(/\/ar\/login$/);

  // The account is gone: asking for a code sends nothing, and the page does not say so.
  const before = await countEmails(page, email);
  await page.getByLabel('البريد الإلكتروني').fill(email);
  await page.getByRole('button', { name: 'أرسل الرمز' }).click();
  await expect(page.getByText(/حساب لدينا/)).toBeVisible();

  // A barrier instead of a fixed wait (CICD-8): a code requested afterwards for a new address
  // goes through the same mail server, so once it arrives, a code sent for the deleted address
  // would have arrived before it.
  const control = uniqueEmail('control');
  await page.goto('/ar/signup');
  await answerAboutYou(page);
  await page.getByLabel('البريد الإلكتروني').fill(control);
  await page.getByRole('button', { name: 'أرسل الرمز' }).click();
  await readCode(page, control);
  expect(await countEmails(page, email)).toBe(before);
});
