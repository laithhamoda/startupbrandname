import { expect, test } from '@playwright/test';
import { signUpByEmail, uniqueEmail } from './helpers';

// Signed-in pages are rendered on every visit, so a click can take a moment to show anything.

test('a link shows that the next page is on its way, and stops once it is there', async ({
  page,
}) => {
  await signUpByEmail(page, uniqueEmail('pending'));

  // Hold every page the client router fetches, as a slow connection would.
  await page.route('**/*', async (route) => {
    if (route.request().headers().rsc === '1') {
      await new Promise((resolve) => setTimeout(resolve, 1_500));
    }
    await route.continue();
  });

  const account = page.getByRole('banner').getByRole('link', { name: 'حسابي' });
  await account.click();
  await expect(account).toHaveAttribute('aria-busy', 'true');

  await expect(page).toHaveURL(/\/ar\/account$/);
  await expect(account).toHaveAttribute('aria-current', 'page');
  await expect(account).not.toHaveAttribute('aria-busy');
});
