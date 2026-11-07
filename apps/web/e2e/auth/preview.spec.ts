import { expect, type Page, test } from '@playwright/test';

// The report for a visitor without an account (D-356). A calculable report needs far more answers than a browser
// test gives quickly; the preview itself and the hidden verdict are proven by the model and view tests. What the
// browser must prove here is the server side: a visitor reaches the report route (it is not an account page),
// is told what is missing, and is refused a file.

async function startVisit(page: Page): Promise<string> {
  await page.goto('/ar/start');
  await page.getByLabel('فكرتك أو اسم مشروعك').fill('خدمة توصيل المشتريات للمسنين');
  await page.getByLabel('بلد إقامتك').selectOption('JO');
  await page.getByLabel('عملة المشروع').selectOption('JOD');
  await page.getByRole('checkbox', { name: /شروط الاستخدام/ }).check();
  await page.getByRole('button', { name: 'ابدأ الآن' }).click();
  await expect(page).toHaveURL(/\/ar\/projects\/[0-9a-f-]{36}\/q\/A1$/);
  return /projects\/([0-9a-f-]{36})/.exec(page.url())?.[1] ?? '';
}

test('a visitor reaches the report route and is told what is missing, with no verdict', async ({
  page,
}) => {
  const id = await startVisit(page);

  await page.goto(`/ar/projects/${id}`);
  const result = page.getByRole('region', { name: 'نتيجة الفحص' });
  await expect(result.getByText('لا تكفي إجاباتك بعد لإصدار تقرير')).toBeVisible();
  await expect(result.locator('[data-verdict]')).toHaveCount(0);

  await page.goto(`/ar/projects/${id}/report`);
  await expect(page).toHaveURL(new RegExp(`/ar/projects/${id}/report$`));
  await expect(
    page.getByRole('heading', { level: 1, name: 'لا تكفي إجاباتك بعد لإصدار تقرير' }),
  ).toBeVisible();
  await expect(page.locator('[data-verdict]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /PDF/ })).toHaveCount(0);
});

test('a visitor is refused the file of the report', async ({ page }) => {
  const id = await startVisit(page);
  const origin = new URL(page.url()).origin;
  const response = await page.request.post(`/api/projects/${id}/report/pdf`, {
    headers: { origin, accept: 'application/json' },
    form: { locale: 'ar' },
    maxRedirects: 0,
  });
  expect(response.status()).toBe(401);
});
