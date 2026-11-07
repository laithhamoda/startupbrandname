import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';
import { countEmails, readCode, signUpByEmail, uniqueEmail } from './helpers';

// Saving a visit begun without an account (D-354): the email is added to the visitor's own identity, so the
// answers and the project stay.

const IDEA = 'خدمة توصيل المشتريات للمسنين';

async function startVisit(page: Page): Promise<string> {
  await page.goto('/ar/start');
  await page.getByLabel('فكرتك أو اسم مشروعك').fill(IDEA);
  await page.getByLabel('بلد إقامتك').selectOption('JO');
  await page.getByLabel('عملة المشروع').selectOption('JOD');
  await page.getByRole('checkbox', { name: /شروط الاستخدام/ }).check();
  await page.getByRole('button', { name: 'ابدأ الآن' }).click();
  await expect(page).toHaveURL(/\/ar\/projects\/[0-9a-f-]{36}\/q\/A1$/);
  return /projects\/([0-9a-f-]{36})/.exec(page.url())?.[1] ?? '';
}

async function saveWithEmail(page: Page, email: string) {
  const before = await countEmails(page, email);
  await page.goto('/ar/save');
  await page.getByLabel('البريد الإلكتروني').fill(email);
  await page.getByRole('button', { name: 'أرسل الرمز' }).click();
  await page.getByLabel('رمز الدخول').fill(await readCode(page, email, before));
  await page.getByRole('button', { name: 'تحقّق وادخل' }).click();
}

test('a visitor saves the visit with an email and keeps the project', async ({ page }) => {
  const project = await startVisit(page);
  await saveWithEmail(page, uniqueEmail('save'));

  // Now an account: the projects page opens, with the same project, and the header has the account links.
  await expect(page).toHaveURL(/\/ar\/projects$/);
  await expect(page.getByRole('link', { name: IDEA })).toHaveAttribute(
    'href',
    new RegExp(`/ar/projects/${project}$`),
  );
  await expect(page.getByRole('banner').getByRole('link', { name: 'حسابي' })).toBeVisible();

  // Nothing to save any more: the save page goes to the projects.
  await page.goto('/ar/save');
  await expect(page).toHaveURL(/\/ar\/projects$/);
});

test('an address that already has an account signs in to it instead, with the same answers on screen', async ({
  page,
  browser,
  baseURL,
}) => {
  const email = uniqueEmail('save-existing');
  const owner = await browser.newPage({ baseURL });
  await signUpByEmail(owner, email);
  await owner.close();

  await startVisit(page);
  await saveWithEmail(page, email);

  // The account's own projects (it has none), not the visitor's.
  await expect(page).toHaveURL(/\/ar\/projects$/);
  await expect(page.getByRole('link', { name: IDEA })).toHaveCount(0);
  await expect(page.getByText('لا مشاريع بعد')).toBeVisible();
});

test('the visit shows how to save it: a card on the project and a link in the header', async ({
  page,
}) => {
  const project = await startVisit(page);
  await expect(page.getByRole('banner').getByRole('link', { name: 'احفظ تقدّمك' })).toBeVisible();

  await page.goto(`/ar/projects/${project}`);
  await expect(page.getByRole('heading', { name: 'احفظ مشروعك', level: 2 })).toBeVisible();
  await page.getByRole('link', { name: 'احفظ بحساب' }).click();
  await expect(page).toHaveURL(/\/ar\/save$/);
});

test('the sign-up page sends a visitor to save the visit, not to a new account', async ({
  page,
}) => {
  await startVisit(page);
  await page.goto('/ar/signup');
  await expect(page).toHaveURL(/\/ar\/save$/);
});

test('the save page has no accessibility violations', async ({ page }) => {
  await startVisit(page);
  await page.goto('/ar/save');
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(results.violations).toEqual([]);
});

test('nobody signed in has anything to save: the save page goes to start', async ({ page }) => {
  await page.goto('/ar/save');
  await expect(page).toHaveURL(/\/ar\/start$/);
});
