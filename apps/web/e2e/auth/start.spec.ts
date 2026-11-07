import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';
import { signUpByEmail, uniqueEmail } from './helpers';

// The first visit without signup (D-350, D-351, D-353): a visitor is signed in anonymously, answers under that
// identity, and reaches only the pages that are theirs.

const IDEA = 'صيانة دورية لمكيّفات المطاعم';

async function fillStart(page: Page, { terms = true }: { terms?: boolean } = {}) {
  await page.goto('/ar/start');
  await page.getByLabel('فكرتك أو اسم مشروعك').fill(IDEA);
  await page.getByLabel('بلد إقامتك').selectOption('JO');
  await page.getByLabel('عملة المشروع').selectOption('JOD');
  if (terms) await page.getByRole('checkbox', { name: /شروط الاستخدام/ }).check();
}

test('a visitor starts without an account and lands on the first question of the full diagnostic', async ({
  page,
}) => {
  await fillStart(page);
  await page.getByRole('button', { name: 'ابدأ الآن' }).click();

  await expect(page).toHaveURL(/\/ar\/projects\/[0-9a-f-]{36}\/q\/A1$/);
  // The full diagnostic: 64 questions (the quick one has 20), counted in the page title.
  await expect(page).toHaveTitle(/^السؤال 1 من \d+ · /);
  const total = Number(/^السؤال 1 من (\d+)/.exec(await page.title())?.[1]);
  expect(total).toBeGreaterThanOrEqual(64);
});

test('the start page says how long it takes and that progress is saved, and has no accessibility violations', async ({
  page,
}) => {
  await page.goto('/ar/start');
  await expect(page.getByRole('note').first()).toContainText('64');
  await expect(page.getByRole('note').first()).toContainText('30 يومًا');
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(results.violations).toEqual([]);
});

test('the terms are required: without them nothing is created and the page says so', async ({
  page,
}) => {
  await fillStart(page, { terms: false });
  await page.getByRole('button', { name: 'ابدأ الآن' }).click();

  await expect(page).toHaveURL(/\/ar\/start$/);
  await expect(
    page.getByText('لا يمكن إنشاء الحساب دون الموافقة على شروط الاستخدام.'),
  ).toBeVisible();
});

test('a visitor who comes back to /start goes to the project they began', async ({ page }) => {
  await fillStart(page);
  await page.getByRole('button', { name: 'ابدأ الآن' }).click();
  await expect(page).toHaveURL(/\/ar\/projects\/[0-9a-f-]{36}\/q\/A1$/);
  const project = /projects\/([0-9a-f-]{36})/.exec(page.url())?.[1] ?? '';

  await page.goto('/ar/start');
  await expect(page).toHaveURL(new RegExp(`/ar/projects/${project}$`));
});

test('a visitor reaches only their own pages: no account pages, and a header without account links', async ({
  page,
}) => {
  await fillStart(page);
  await page.getByRole('button', { name: 'ابدأ الآن' }).click();
  await expect(page).toHaveURL(/\/q\/A1$/);

  const header = page.getByRole('banner');
  await expect(header.getByRole('link', { name: 'مشاريعي' })).toHaveCount(0);
  await expect(header.getByRole('link', { name: 'حسابي' })).toHaveCount(0);

  // The account pages send a visitor to sign in (D-350).
  await page.goto('/ar/projects');
  await expect(page).toHaveURL(/\/ar\/login/);
  await page.goto('/ar/account');
  await expect(page).toHaveURL(/\/ar\/login/);
  await page.goto('/ar/projects/new');
  await expect(page).toHaveURL(/\/ar\/login/);
});

test('an account that opens /start goes to its own projects', async ({ page }) => {
  await signUpByEmail(page, uniqueEmail('start-account'));
  await page.goto('/ar/start');
  await expect(page).toHaveURL(/\/ar\/projects$/);
});
