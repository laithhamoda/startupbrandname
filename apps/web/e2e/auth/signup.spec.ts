import { expect, test } from '@playwright/test';
import { answerAboutYou, MAILPIT_URL, readCode, signUpByEmail, uniqueEmail } from './helpers';

test('someone signs up with an email code and lands on their projects', async ({ page }) => {
  const email = uniqueEmail('founder');
  await signUpByEmail(page, email);

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('مشاريعي');
  await page.getByRole('link', { name: 'حسابي' }).click();
  await expect(page.getByText(email)).toBeVisible();
  await expect(page.getByLabel('بلد إقامتك')).toHaveValue('JO');
  await expect(page.getByText(/موافقتك غير مفعّلة/)).toBeVisible();
});

test('"no" to the project question does not block signup (D-086)', async ({ page }) => {
  const email = uniqueEmail('no-project');
  await page.goto('/ar/signup');
  await answerAboutYou(page, { project: 'لا' });
  await page.getByLabel('البريد الإلكتروني').fill(email);
  await page.getByRole('button', { name: 'أرسل الرمز' }).click();
  await page.getByLabel('رمز الدخول').fill(await readCode(page, email));
  await page.getByRole('button', { name: 'تحقّق وادخل' }).click();

  await expect(page).toHaveURL(/\/ar\/projects$/);
});

test('missing answers are marked next to each field', async ({ page }) => {
  await page.goto('/ar/signup');
  await page.getByRole('button', { name: 'متابعة' }).click();

  await expect(page.getByText('هذه الإجابة مطلوبة.')).toHaveCount(2);
  await expect(
    page.getByText('لا يمكن إنشاء الحساب دون الموافقة على شروط الاستخدام.'),
  ).toBeVisible();
  await expect(page.getByLabel('بلد إقامتك')).toBeFocused();
});

test('a wrong code is rejected with an explanation', async ({ page }) => {
  const email = uniqueEmail('wrong-code');
  await page.goto('/ar/signup');
  await answerAboutYou(page);
  await page.getByLabel('البريد الإلكتروني').fill(email);
  await page.getByRole('button', { name: 'أرسل الرمز' }).click();
  const code = await readCode(page, email);

  await page
    .getByLabel('رمز الدخول')
    .fill(code.startsWith('0') ? '1'.repeat(code.length) : '0'.repeat(code.length));
  await page.getByRole('button', { name: 'تحقّق وادخل' }).click();

  await expect(page.getByText(/الرمز غير صحيح أو انتهت صلاحيته/)).toBeVisible();
  await expect(page).toHaveURL(/\/ar\/signup$/);
});

test('signup in English sends the code email in English', async ({ page }) => {
  const email = uniqueEmail('english');
  await page.goto('/en/signup');
  await page.getByLabel('Country of residence').selectOption('GB');
  await page
    .getByRole('radiogroup', { name: /project or a project idea/ })
    .getByRole('radio', { name: 'Yes' })
    .check();
  await page.getByRole('checkbox', { name: /terms of use/ }).check();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByLabel('Email').fill(email);
  await page.getByRole('button', { name: 'Send the code' }).click();

  await expect(page.getByText(/We sent an 8-digit code to/)).toBeVisible();
  const code = await readCode(page, email);
  const search = await page.request.get(`${MAILPIT_URL}/api/v1/search`, {
    params: { query: `to:"${email}"` },
  });
  const { messages } = (await search.json()) as { messages: { ID: string }[] };
  const message = (await (
    await page.request.get(`${MAILPIT_URL}/api/v1/message/${messages[0]?.ID ?? ''}`)
  ).json()) as { HTML: string };
  expect(message.HTML).toContain('Your sign-in code');

  await page.getByLabel('Sign-in code').fill(code);
  await page.getByRole('button', { name: 'Verify and sign in' }).click();
  await expect(page).toHaveURL(/\/en\/projects$/);
});
