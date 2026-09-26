import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';
import { answerAboutYou, readCode, signUpByEmail, uniqueEmail } from './helpers';

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

async function expectNoViolations(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  expect(results.violations.map((violation) => `${violation.id}: ${violation.help}`)).toEqual([]);
}

// Signed-in pages, in both languages and both themes (CLAUDE.md §4 rule 11).
for (const scheme of ['light', 'dark'] as const) {
  test(`signed-in pages have no WCAG 2.2 AA violations in ${scheme} theme`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await signUpByEmail(page, uniqueEmail(`a11y-${scheme}`));

    for (const path of ['/ar/projects', '/ar/account', '/en/projects', '/en/account']) {
      await page.goto(path);
      await expectNoViolations(page);
    }
  });
}

test('the signup steps and the onboarding gate have no WCAG 2.2 AA violations', async ({
  page,
}) => {
  const email = uniqueEmail('a11y-steps');
  await page.goto('/ar/signup');
  await page.getByRole('button', { name: 'متابعة' }).click();
  await expectNoViolations(page); // step 1 with every error shown

  await answerAboutYou(page);
  await expectNoViolations(page); // step 2

  await page.getByLabel('البريد الإلكتروني').fill(email);
  await page.getByRole('button', { name: 'أرسل الرمز' }).click();
  await expect(page.getByLabel('رمز الدخول')).toBeVisible();
  await expectNoViolations(page); // step 3

  // Forgetting the answers before verifying leaves an account without declarations.
  const code = await readCode(page, email);
  await page.context().clearCookies();
  await page.getByLabel('رمز الدخول').fill(code);
  await page.getByRole('button', { name: 'تحقّق وادخل' }).click();
  await expect(page).toHaveURL(/\/ar\/onboarding$/);
  await expectNoViolations(page);
});
