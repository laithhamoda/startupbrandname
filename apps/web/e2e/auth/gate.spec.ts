import { expect, type Page, test } from '@playwright/test';
import { answerDeclarations, countEmails, readCode, uniqueEmail } from './helpers';

/**
 * Signs in with an account that has no declarations, the state Google sign-in leaves a new user
 * in (D-065): the browser forgets the signup answers before the code is verified.
 * (Asking for a second code instead would hit Supabase's once-a-minute resend limit.)
 */
async function signInWithoutDeclarations(page: Page, email: string) {
  await page.goto('/ar/signup');
  await answerDeclarations(page);
  await page.getByLabel('البريد الإلكتروني').fill(email);
  await page.getByRole('button', { name: 'أرسل الرمز' }).click();
  const code = await readCode(page, email);
  await page.context().clearCookies();
  await page.getByLabel('رمز الدخول').fill(code);
  await page.getByRole('button', { name: 'تحقّق وادخل' }).click();
}

async function answerGate(page: Page, adult: 'نعم' | 'لا') {
  await page.getByLabel('بلد إقامتك').selectOption('DZ');
  await page
    .getByRole('radiogroup', { name: /المرحلة الثانوية/ })
    .getByRole('radio', { name: 'نعم' })
    .check();
  await page
    .getByRole('radiogroup', { name: /18 سنة/ })
    .getByRole('radio', { name: adult })
    .check();
  await page.getByRole('checkbox', { name: /شروط الاستخدام/ }).check();
  await page.getByRole('button', { name: 'أكمل الحساب' }).click();
}

test('an account without declarations is held at the gate until it completes', async ({ page }) => {
  await signInWithoutDeclarations(page, uniqueEmail('gate'));

  await expect(page).toHaveURL(/\/ar\/onboarding$/);
  await page.goto('/ar/account');
  await expect(page).toHaveURL(/\/ar\/onboarding$/);

  await answerGate(page, 'نعم');
  await expect(page).toHaveURL(/\/ar\/projects$/);
});

test('a "no" at the gate deletes the account at once', async ({ page }) => {
  const email = uniqueEmail('gate-refused');
  await signInWithoutDeclarations(page, email);
  await expect(page).toHaveURL(/\/ar\/onboarding$/);

  await answerGate(page, 'لا');

  await expect(page).toHaveURL(/\/ar\/not-eligible\?reason=adult$/);
  await expect(page.getByText(/حذفنا الحساب الذي أُنشئ عند الدخول/)).toBeVisible();
  await page.goto('/ar/projects');
  await expect(page).toHaveURL(/\/ar\/login$/);

  // The account is gone: asking for a code sends nothing, and the page does not say so.
  const before = await countEmails(page, email);
  await page.getByLabel('البريد الإلكتروني').fill(email);
  await page.getByRole('button', { name: 'أرسل الرمز' }).click();
  await expect(page.getByText(/إذا كان للبريد/)).toBeVisible();
  await page.waitForTimeout(3_000);
  expect(await countEmails(page, email)).toBe(before);
});
