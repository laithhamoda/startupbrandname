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

test('leaving a question with an unsaved answer asks first', async ({ page }) => {
  await signUpByEmail(page, uniqueEmail('leave'));
  await createProject(page);
  await page.getByLabel('المدينة').fill('إربد');
  await page.getByRole('button', { name: 'التالي' }).click();
  await expect(page).toHaveURL(/\/q\/A8$/);

  // Choosing an answer without saving it: Previous asks, and staying keeps the choice.
  const income = page.getByRole('radio', { name: 'دخل رئيسي' });
  await income.click();
  const previous = page.getByRole('link', { name: 'السابق' });
  await previous.click();
  const dialog = page.getByRole('dialog', { name: 'المغادرة دون حفظ إجابتك؟' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'ابقَ في هذا السؤال' })).toBeFocused();
  await expectNoViolations(page);
  await dialog.getByRole('button', { name: 'ابقَ في هذا السؤال' }).click();
  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(/\/q\/A8$/);
  await expect(income).toBeChecked();
  await expect(previous).toBeFocused();

  // The language switch asks too; leaving anyway follows it as usual.
  await page.getByRole('link', { name: 'English' }).click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'غادِر دون حفظ' }).click();
  await expect(page).toHaveURL(/\/en\/projects\/[0-9a-f-]{36}\/q\/A8$/);

  // Nothing typed: Previous goes straight back, to the answer saved before.
  await page.getByRole('link', { name: 'Previous' }).click();
  await expect(page).toHaveURL(/\/en\/projects\/[0-9a-f-]{36}\/q\/A1$/);
  await expect(page.getByLabel('City')).toHaveValue('إربد');
});

test('on a phone, staying returns focus to the answer, since the menu has closed', async ({
  page,
}) => {
  await signUpByEmail(page, uniqueEmail('leave-menu'));
  await createProject(page);
  await page.setViewportSize({ width: 390, height: 844 });
  const city = page.getByLabel('المدينة');
  await city.fill('إربد');

  // Below 1280px the header links sit in the menu panel, which closes with the dialog.
  await page.getByRole('button', { name: 'القائمة' }).click();
  const projects = page.getByRole('banner').getByRole('link', { name: 'مشاريعي' });
  await projects.click();
  const dialog = page.getByRole('dialog', { name: 'المغادرة دون حفظ إجابتك؟' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'ابقَ في هذا السؤال' }).click();
  await expect(dialog).toBeHidden();
  await expect(projects).toBeHidden();
  await expect(city).toBeFocused();
  await expect(city).toHaveValue('إربد');
});
