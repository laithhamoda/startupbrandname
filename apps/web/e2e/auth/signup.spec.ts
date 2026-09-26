import { expect, test } from '@playwright/test';
import { answerDeclarations, MAILPIT_URL, readCode, signUpByEmail, uniqueEmail } from './helpers';

test('an adult signs up with an email code and lands on their projects', async ({ page }) => {
  const email = uniqueEmail('adult');
  await signUpByEmail(page, email);

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('مشاريعي');
  await page.getByRole('link', { name: 'حسابي' }).click();
  await expect(page.getByText(email)).toBeVisible();
  await expect(page.getByLabel('بلد إقامتك')).toHaveValue('JO');
  await expect(page.getByText(/موافقتك غير مفعّلة/)).toBeVisible();
});

test('someone under 18 is refused and nothing reaches the server', async ({ page }) => {
  await page.goto('/ar/signup');
  const posts: string[] = [];
  page.on('request', (request) => {
    if (request.method() !== 'GET') posts.push(request.url());
  });

  await answerDeclarations(page, { adult: 'لا' });

  await expect(page.getByRole('heading', { name: 'المنصة غير متاحة لك الآن' })).toBeFocused();
  await expect(page.getByText('لم نحفظ أي معلومة عنك.')).toBeVisible();
  expect(posts).toEqual([]);
});

test('someone without secondary school is refused the same way', async ({ page }) => {
  await page.goto('/ar/signup');
  await answerDeclarations(page, { secondary: 'لا' });

  await expect(page.getByText(/لمن أنهوا المرحلة الثانوية/)).toBeVisible();
});

test('missing answers are marked next to each field', async ({ page }) => {
  await page.goto('/ar/signup');
  await page.getByRole('button', { name: 'متابعة' }).click();

  await expect(page.getByText('هذه الإجابة مطلوبة.')).toHaveCount(3);
  await expect(
    page.getByText('لا يمكن إنشاء الحساب دون الموافقة على شروط الاستخدام.'),
  ).toBeVisible();
  await expect(page.getByLabel('بلد إقامتك')).toBeFocused();
});

test('a wrong code is rejected with an explanation', async ({ page }) => {
  const email = uniqueEmail('wrong-code');
  await page.goto('/ar/signup');
  await answerDeclarations(page);
  await page.getByLabel('البريد الإلكتروني').fill(email);
  await page.getByRole('button', { name: 'أرسل الرمز' }).click();
  const code = await readCode(page, email);

  await page.getByLabel('رمز الدخول').fill(code === '000000' ? '111111' : '000000');
  await page.getByRole('button', { name: 'تحقّق وادخل' }).click();

  await expect(page.getByText(/الرمز غير صحيح أو انتهت صلاحيته/)).toBeVisible();
  await expect(page).toHaveURL(/\/ar\/signup$/);
});

test('signup in English sends the code email in English', async ({ page }) => {
  const email = uniqueEmail('english');
  await page.goto('/en/signup');
  await page.getByLabel('Country of residence').selectOption('GB');
  await page
    .getByRole('radiogroup', { name: /secondary school/ })
    .getByRole('radio', { name: 'Yes' })
    .check();
  await page
    .getByRole('radiogroup', { name: /18 or older/ })
    .getByRole('radio', { name: 'Yes' })
    .check();
  await page.getByRole('checkbox', { name: /terms of use/ }).check();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByLabel('Email').fill(email);
  await page.getByRole('button', { name: 'Send the code' }).click();

  await expect(page.getByText(/We sent a 6-digit code to/)).toBeVisible();
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
