import { expect, type Page, test } from '@playwright/test';
import { signUpByEmail, uniqueEmail } from './helpers';

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

// The PDF route (M5 step 6, D-280). A full PDF needs a project with 40% of the answers and a
// browser inside the function, which the e2e server does not have; the file itself is read back by
// the PDF specs of apps/web/e2e/pdf and the route's decisions by its unit tests. What the browser
// must prove here is the edge: no button below the gate, a refusal for a project that has no report,
// and a refusal for a post from another site, all without a PDF.
test('a new account has no PDF button and is refused a PDF it has no right to', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await signUpByEmail(page, uniqueEmail('report-pdf'));
  const id = await createProject(page);
  const route = `/api/projects/${id}/report/pdf`;
  const origin = new URL(page.url()).origin;

  // Below the gate the report page draws no report and so no button.
  await page.goto(`/ar/projects/${id}/report`);
  await expect(page.locator('[data-pdf-download]')).toHaveCount(0);

  // The account's own page posting for a project without a report: a plain refusal, no file.
  const noReport = await page.request.post(route, {
    headers: { origin, accept: 'application/json' },
    form: { locale: 'ar' },
    maxRedirects: 0,
  });
  expect(noReport.status()).toBe(403);
  expect(await noReport.json()).toEqual({ error: 'not_allowed' });

  // Another site's page may not post, whatever the project.
  const crossSite = await page.request.post(route, {
    headers: { origin: 'https://example.invalid', accept: 'application/json' },
    form: { locale: 'ar' },
    maxRedirects: 0,
  });
  expect(crossSite.status()).toBe(403);

  // A project that is not the account's is a not found, and a GET is not a route at all.
  const other = await page.request.post(
    '/api/projects/00000000-0000-4000-8000-000000000000/report/pdf',
    {
      headers: { origin, accept: 'application/json' },
      form: { locale: 'ar' },
      maxRedirects: 0,
    },
  );
  expect(other.status()).toBe(404);
  expect((await page.request.get(route)).status()).toBe(405);

  // A form that comes back with a refusal code shows its sentence only for a known code.
  await page.goto(`/ar/projects/${id}/report?pdf=limit`);
  await expect(page.locator('[data-pdf-error]')).toHaveCount(0);
});
