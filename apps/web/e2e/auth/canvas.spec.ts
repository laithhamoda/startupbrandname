import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';
import { signUpByEmail, uniqueEmail } from './helpers';

const NEXT = 'التالي';
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

async function next(page: Page, step: string) {
  await page.getByRole('button', { name: NEXT }).click();
  await expect(page).toHaveURL(new RegExp(`/q/${step}$`));
}

/** The answers the engine needs to calculate: the price, the costs and the sales (F1, F3, F4, F6). */
async function answerWhatTheEngineNeeds(page: Page, id: string) {
  await page.goto(`/ar/projects/${id}/q/F1`);
  await page.getByLabel('المبلغ').fill('20');
  await next(page, 'F2');

  await page.goto(`/ar/projects/${id}/q/F3`);
  await page.getByLabel('البند', { exact: true }).fill('قطع غيار');
  await page.getByLabel('المبلغ').fill('8');
  await next(page, 'F4');

  await page.getByLabel('البند', { exact: true }).fill('إيجار المكتب');
  await page.getByLabel('المبلغ').fill('300');
  await next(page, 'F4-1');

  await page.goto(`/ar/projects/${id}/q/F6`);
  await page.getByLabel('الشهر 1', { exact: true }).fill('5');
  await page.getByLabel('الشهر 6', { exact: true }).fill('15');
  await page.getByLabel('الشهر 12', { exact: true }).fill('30');
  await page.getByRole('button', { name: NEXT }).click();
  await expect(page).toHaveURL(/\/q\/F6-2$/);
}

test('a founder edits a chip of the canvas, comes back, and sees the chip and the total change', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await signUpByEmail(page, uniqueEmail('canvas'));
  const id = await createProject(page);
  await answerWhatTheEngineNeeds(page, id);

  // The project page leads to the canvases.
  await page.goto(`/ar/projects/${id}`);
  await page.getByRole('link', { name: 'لوحتا المشروع' }).click();
  await expect(page).toHaveURL(new RegExp(`/ar/projects/${id}/canvas$`));
  await expect(page).toHaveTitle(/لوحتا المشروع/);
  await expect(page.getByRole('heading', { level: 1, name: 'لوحتا المشروع' })).toBeVisible();

  // Nine labelled regions, in the Business Model Canvas, each with its heading.
  const businessModel = page.getByRole('tabpanel');
  await expect(businessModel.getByRole('region')).toHaveCount(9);
  const costs = businessModel.getByRole('region', { name: /هيكل التكاليف/ });
  const rent = costs.getByRole('link', { name: /إيجار المكتب/ });
  await expect(rent).toContainText('300');
  // The engine's totals sit beside the chips, with the currency after the number.
  await expect(costs.locator('dl')).toContainText('300');
  await expect(costs.locator('dl')).toContainText('د.أ');

  // A block with no answer says so and sends the founder to its question.
  const relationships = businessModel.getByRole('region', { name: /علاقات العملاء/ });
  await expect(relationships).toContainText('لم تتم الإجابة بعد.');
  await expect(relationships.getByRole('link')).toHaveAttribute('href', /\/q\/C7-1\?from=canvas$/);

  // The chip is a link to the question that holds the answer, which brings the founder back.
  await rent.click();
  await expect(page).toHaveURL(new RegExp(`/q/F4\\?from=canvas$`));
  await expect(page.getByRole('link', { name: 'العودة إلى اللوحتين' })).toBeVisible();
  await expect(page.getByLabel('المبلغ')).toHaveValue('300');
  await page.getByLabel('المبلغ').fill('450');
  await page.getByRole('button', { name: NEXT }).click();

  // Saving returns to the canvas, which shows the new chip and the recomputed total.
  await expect(page).toHaveURL(new RegExp(`/ar/projects/${id}/canvas$`));
  const costsAfter = page.getByRole('tabpanel').getByRole('region', { name: /هيكل التكاليف/ });
  await expect(costsAfter.getByRole('link', { name: /إيجار المكتب/ })).toContainText('450');
  await expect(costsAfter.locator('dl')).toContainText('450');
  await expect(costsAfter.locator('dl')).not.toContainText('300');

  // The Lean Canvas is built from the same answers.
  await page.getByRole('tab', { name: /اللوحة الرشيقة/ }).click();
  const problem = page
    .getByRole('tabpanel')
    .getByRole('region', { name: /المشكلة والبدائل الحالية/ });
  await expect(problem).toBeVisible();
  await expect(page.getByRole('tabpanel').getByRole('region')).toHaveCount(9);
});

test('the canvas has no WCAG 2.2 AA violations in either language, tab or theme', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await signUpByEmail(page, uniqueEmail('canvas-a11y'));
  const id = await createProject(page);
  await answerWhatTheEngineNeeds(page, id);

  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    for (const locale of ['ar', 'en'] as const) {
      await page.goto(`/${locale}/projects/${id}/canvas`);
      await expect(page).toHaveTitle(/\S/);
      await page.evaluate(() => document.fonts.ready);
      for (const tab of [0, 1]) {
        await page.getByRole('tab').nth(tab).click();
        const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
        expect(
          results.violations.map((violation) => `${violation.id}: ${violation.help}`),
          `${locale} ${scheme} tab ${String(tab)}`,
        ).toEqual([]);
      }
    }
  }
});

test('on a phone the blocks stack, customer segments first, and the page never scrolls sideways', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await signUpByEmail(page, uniqueEmail('canvas-phone'));
  const id = await createProject(page);
  await answerWhatTheEngineNeeds(page, id);

  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto(`/ar/projects/${id}/canvas`);
  const headings = page.getByRole('tabpanel').getByRole('heading', { level: 3 });
  await expect(headings.first()).toContainText('شرائح العملاء');
  await expect(headings).toHaveCount(9);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
