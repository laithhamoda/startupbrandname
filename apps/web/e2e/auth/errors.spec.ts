import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';
import { signUpByEmail, uniqueEmail } from './helpers';

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

async function expectNoViolations(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  expect(results.violations.map((violation) => `${violation.id}: ${violation.help}`)).toEqual([]);
}

/** Creates a quick-mode project and lands on its first question. */
async function createProject(page: Page) {
  await page.goto('/ar/projects');
  await page.getByRole('link', { name: 'مشروع جديد' }).click();
  await page.getByLabel('اسم المشروع').fill('صيانة مكيّفات المطاعم');
  await page.getByLabel('عملة المشروع').selectOption('JOD');
  await page.getByRole('radio', { name: /السريعة/ }).click();
  await page.getByRole('button', { name: 'أنشئ المشروع وابدأ' }).click();
  await expect(page).toHaveURL(/\/ar\/projects\/[0-9a-f-]{36}\/q\/A1$/);
}

/** Makes every Server Action call fail as if the connection had dropped. */
async function dropServerActions(page: Page) {
  await page.route('**/*', (route) =>
    route.request().method() === 'POST' && route.request().headers()['next-action']
      ? route.abort('internetdisconnected')
      : route.continue(),
  );
}

test('a failing signed-in page keeps the app header and offers a retry and a way back', async ({
  page,
}) => {
  await signUpByEmail(page, uniqueEmail('error-page'));
  // Internal page that always fails outside production.
  await page.goto('/ar/failure-check');

  const heading = page.getByRole('heading', { level: 1, name: 'حدث خطأ غير متوقّع' });
  await expect(heading).toBeFocused();
  await expect(page.getByRole('banner').getByRole('link', { name: 'حسابي' })).toBeAttached();
  await expect(page.getByText(/^رقم المرجع:/)).toBeVisible();
  await expectNoViolations(page);

  await page.getByRole('button', { name: 'حاول مرة أخرى' }).click();
  await expect(heading).toBeVisible();

  await page.getByRole('link', { name: 'العودة إلى مشاريعي' }).click();
  await expect(page).toHaveURL(/\/ar\/projects$/);
});

test('an answer that cannot reach the server stays in the form', async ({ page }) => {
  await signUpByEmail(page, uniqueEmail('save-offline'));
  await createProject(page);
  const city = page.getByLabel('المدينة');
  await city.fill('إربد');

  await dropServerActions(page);
  await page.getByRole('button', { name: 'التالي' }).click();
  await expect(page.getByText('تعذّر الحفظ. إجابتك ما زالت هنا، فحاول مرة أخرى.')).toBeVisible();
  await expect(city).toHaveValue('إربد');

  await page.unrouteAll();
  await page.getByRole('button', { name: 'التالي' }).click();
  await expect(page).toHaveURL(/\/q\/A8$/);
});

test('an answer for a project deleted in another window says why and leads on', async ({
  page,
}) => {
  await signUpByEmail(page, uniqueEmail('save-gone'));
  await createProject(page);
  const city = page.getByLabel('المدينة');
  await city.fill('إربد');

  // The same founder deletes the project in a second window.
  const other = await page.context().newPage();
  await other.goto(page.url().replace(/\/q\/A1$/, ''));
  await other.getByRole('button', { name: 'احذف المشروع', exact: true }).click();
  await other
    .getByRole('dialog', { name: 'حذف المشروع نهائيًا؟' })
    .getByRole('button', { name: 'نعم، احذف المشروع' })
    .click();
  await expect(other).toHaveURL(/\/ar\/projects$/);
  await other.close();

  // The explanation stays on screen: nothing replaces the page with a missing-page notice.
  await page.getByRole('button', { name: 'التالي' }).click();
  await expect(page.getByText(/^لم يعد هذا المشروع موجودًا/)).toBeVisible();
  await expect(page).toHaveURL(/\/q\/A1$/);
  await expect(city).toHaveValue('إربد');
  await expectNoViolations(page);

  // Nothing is left that could be saved, so the link leaves without asking first.
  await page.getByRole('link', { name: 'العودة إلى مشاريعي', exact: true }).click();
  await expect(page).toHaveURL(/\/ar\/projects$/);
});

const ACTION_FAILED = 'تعذّر إكمال الطلب. حاول مرة أخرى بعد قليل.';

test('project settings that cannot reach the server say so and stay usable', async ({ page }) => {
  await signUpByEmail(page, uniqueEmail('settings-offline'));
  await createProject(page);
  await page.goto(page.url().replace(/\/q\/A1$/, ''));

  await dropServerActions(page);
  const toFull = page.getByRole('button', { name: 'انتقل إلى النسخة الكاملة' });
  await toFull.click();
  await expect(page.getByText(ACTION_FAILED)).toBeVisible();
  await expect(toFull).toBeEnabled();

  await page.getByRole('button', { name: 'احذف المشروع', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'حذف المشروع نهائيًا؟' });
  await dialog.getByRole('button', { name: 'نعم، احذف المشروع' }).click();
  await expect(dialog.getByText(ACTION_FAILED)).toBeVisible();
  await expectNoViolations(page);

  // Opening the dialog again starts afresh: the earlier error is not shown or announced again.
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await page.getByRole('button', { name: 'احذف المشروع', exact: true }).click();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(ACTION_FAILED)).toHaveCount(0);

  await page.unrouteAll();
  await dialog.getByRole('button', { name: 'نعم، احذف المشروع' }).click();
  await expect(page).toHaveURL(/\/ar\/projects$/);
});

test('account forms that cannot reach the server say so, and the delete dialog stays open', async ({
  page,
}) => {
  await signUpByEmail(page, uniqueEmail('account-offline'));
  await page.goto('/ar/account');

  await dropServerActions(page);
  await page.getByRole('button', { name: 'فعّل الموافقة' }).click();
  await expect(page.getByText(ACTION_FAILED)).toBeVisible();
  await expect(page.getByText(/موافقتك غير مفعّلة/)).toBeVisible();

  await page.getByRole('button', { name: 'احذف حسابي', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'حذف الحساب نهائيًا؟' });
  await dialog.getByRole('button', { name: 'نعم، احذف حسابي' }).click();
  await expect(dialog.getByText(ACTION_FAILED)).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await page.getByRole('button', { name: 'احذف حسابي', exact: true }).click();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(ACTION_FAILED)).toHaveCount(0);

  await page.unrouteAll();
  await dialog.getByRole('button', { name: 'نعم، احذف حسابي' }).click();
  await expect(page).toHaveURL(/\/ar\/goodbye$/);
});
