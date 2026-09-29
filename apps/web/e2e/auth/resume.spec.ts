import { expect, test } from '@playwright/test';
import { countEmails, readCode, signUpByEmail, uniqueEmail } from './helpers';

test('sign-in comes back to the page that asked for it', async ({ page }) => {
  // Supabase sends one code per address per minute, so this test waits out that minute.
  test.setTimeout(150_000);
  const email = uniqueEmail('resume');
  await signUpByEmail(page, email);

  // The session ends (it expired, or this is another browser) and a saved link is opened.
  await page.context().clearCookies();
  await page.goto('/ar/account');
  await expect(page).toHaveURL(/\/ar\/login\?next=%2Far%2Faccount$/);

  await page.waitForTimeout(61_000);
  const before = await countEmails(page, email);
  await page.getByLabel('البريد الإلكتروني').fill(email);
  await page.getByRole('button', { name: 'أرسل الرمز' }).click();
  await page.getByLabel('رمز الدخول').fill(await readCode(page, email, before));
  await page.getByRole('button', { name: 'تحقّق وادخل' }).click();

  await expect(page).toHaveURL(/\/ar\/account$/);
});

test('a signed-in visitor sent to sign-in goes straight back, and never to another site', async ({
  page,
}) => {
  await signUpByEmail(page, uniqueEmail('resume-signed-in'));

  await page.goto('/ar/login?next=%2Far%2Faccount');
  await expect(page).toHaveURL(/\/ar\/account$/);
  await page.goto('/ar/login?next=https%3A%2F%2Fevil.example%2Far');
  await expect(page).toHaveURL(/\/ar\/projects$/);
});
