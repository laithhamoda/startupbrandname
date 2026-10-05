import { expect, test } from '@playwright/test';
import { delayFonts, expectNoLayoutShift } from '../layout-shift';
import { signUpByEmail, uniqueEmail } from './helpers';

// A diagnostic step, the page founders spend most time on, loaded with the fonts arriving after
// the first paint (PERF-5); the public pages are measured in e2e/quality.spec.ts.
test('a diagnostic step loads without layout shift when the fonts swap in', async ({ page }) => {
  await signUpByEmail(page, uniqueEmail('shift'));
  await page.goto('/ar/projects');
  await page.getByRole('link', { name: 'مشروع جديد' }).click();
  await page.getByLabel('اسم المشروع').fill('مخبز الحي');
  await page.getByLabel('عملة المشروع').selectOption('JOD');
  await page.getByRole('radio', { name: /السريعة/ }).click();
  await page.getByRole('button', { name: 'أنشئ المشروع وابدأ' }).click();
  await expect(page).toHaveURL(/\/q\/A1$/);

  // A fresh load of the step, as when a founder comes back to it. Routing turns off the browser
  // cache, so the fonts are fetched (and held back) again.
  await delayFonts(page);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

  await expectNoLayoutShift(page);
});
