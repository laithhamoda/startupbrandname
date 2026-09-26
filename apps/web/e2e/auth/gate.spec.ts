import { expect, type Page, test } from '@playwright/test';
import { answerAboutYou, fillAboutYou, readCode, uniqueEmail } from './helpers';

/**
 * Signs in with an account that has not answered the first signup step, the state Google sign-in
 * leaves a new user in (D-065): the browser forgets the answers before the code is verified.
 * (Asking for a second code instead would hit Supabase's once-a-minute resend limit.)
 */
async function signInWithoutAnswers(page: Page, email: string) {
  await page.goto('/ar/signup');
  await answerAboutYou(page);
  await page.getByLabel('البريد الإلكتروني').fill(email);
  await page.getByRole('button', { name: 'أرسل الرمز' }).click();
  const code = await readCode(page, email);
  await page.context().clearCookies();
  await page.getByLabel('رمز الدخول').fill(code);
  await page.getByRole('button', { name: 'تحقّق وادخل' }).click();
}

test('an account without answers is held at the gate until it completes', async ({ page }) => {
  await signInWithoutAnswers(page, uniqueEmail('gate'));

  await expect(page).toHaveURL(/\/ar\/onboarding$/);
  await page.goto('/ar/account');
  await expect(page).toHaveURL(/\/ar\/onboarding$/);

  await fillAboutYou(page, { country: 'DZ', project: 'لا' });
  await page.getByRole('button', { name: 'أكمل الحساب' }).click();
  await expect(page).toHaveURL(/\/ar\/projects$/);

  await page.goto('/ar/account');
  await expect(page.getByLabel('بلد إقامتك')).toHaveValue('DZ');
});
