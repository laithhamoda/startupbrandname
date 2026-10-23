import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';
import { signUpByEmail, uniqueEmail } from './helpers';

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

/** Creates a full-version project in dinars from "My projects" and returns its ID. */
async function createProject(page: Page): Promise<string> {
  await page.goto('/ar/projects');
  await page.getByRole('link', { name: 'مشروع جديد' }).click();
  await page.getByLabel('اسم المشروع').fill('صيانة مكيّفات المطاعم');
  await page.getByLabel('عملة المشروع').selectOption('JOD');
  await page.getByRole('radio', { name: /الكاملة/ }).click();
  await page.getByRole('button', { name: 'أنشئ المشروع وابدأ' }).click();
  await expect(page).toHaveURL(/\/ar\/projects\/[0-9a-f-]{36}\/q\/A1$/);
  return /projects\/([0-9a-f-]{36})/.exec(page.url())?.[1] ?? '';
}

// The report route (M5 step 5b, D-273). The summary and the full report need a project with 40%
// and 80% of the answers, which the browser cannot give quickly; those pages are checked by the
// view tests (the locks and the leak test) and by the gallery specs. What the browser must prove
// here is the server side: the entry on the project page, the gate, and that an account that is not
// on the preview list is never handed a report it has no right to (D-245).
test('a new account reaches the report route and is told what is missing, with no report', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await signUpByEmail(page, uniqueEmail('report'));
  const id = await createProject(page);

  // The project page draws the check result in its own region, and below the gate it says there
  // is nothing to show yet, with no verdict (D-286). The entry has one name for every gate.
  await page.goto(`/ar/projects/${id}`);
  const result = page.getByRole('region', { name: 'نتيجة الفحص' });
  await expect(result.getByText('لا تكفي إجاباتك بعد لإصدار تقرير')).toBeVisible();
  await expect(result.locator('[data-verdict]')).toHaveCount(0);
  await page.getByRole('link', { name: 'نتيجة فحص مشروعك' }).click();
  await expect(page).toHaveURL(new RegExp(`/ar/projects/${id}/report$`));

  // The title never carries the founder's project title, and the page is kept out of search.
  await expect(page).toHaveTitle(/تقرير المشروع/);
  await expect(page).not.toHaveTitle(/مكيّفات/);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);

  await expect(
    page.getByRole('heading', { level: 1, name: 'لا تكفي إجاباتك بعد لإصدار تقرير' }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: 'أهم الأسئلة الناقصة' })).toBeVisible();
  // No section of a report, locked or not, and no verdict.
  await expect(page.locator('[data-report-reveal]')).toHaveCount(0);
  await expect(page.getByRole('navigation', { name: 'محتويات التقرير' })).toHaveCount(0);

  // A missing question is a link to answer it.
  const missing = page.getByRole('region', { name: 'أهم الأسئلة الناقصة' }).getByRole('link');
  await expect(missing.first()).toHaveAttribute('href', new RegExp(`/ar/projects/${id}/q/`));

  // The English page says the same in English.
  await page.goto(`/en/projects/${id}/report`);
  await expect(
    page.getByRole('heading', { level: 1, name: 'Your answers are not enough for a report yet' }),
  ).toBeVisible();
});

test('the page has no WCAG 2.2 AA violations, and an unknown project is not found', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await signUpByEmail(page, uniqueEmail('report-a11y'));
  const id = await createProject(page);

  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    for (const locale of ['ar', 'en'] as const) {
      await page.goto(`/${locale}/projects/${id}/report`);
      await expect(page).toHaveTitle(/\S/);
      await page.evaluate(() => document.fonts.ready);
      const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
      expect(
        results.violations.map((violation) => `${violation.id}: ${violation.help}`),
        `${locale} ${scheme}`,
      ).toEqual([]);
    }
  }

  // An address that is not the account's project is a 404, never a report.
  const response = await page.goto('/ar/projects/00000000-0000-4000-8000-000000000000/report');
  expect(response?.status()).toBe(404);
});
