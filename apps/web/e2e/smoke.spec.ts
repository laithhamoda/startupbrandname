import { expect, test } from '@playwright/test';

test('root document is Arabic and right-to-left', async ({ page }) => {
  await page.goto('/');

  const html = page.locator('html');
  await expect(html).toHaveAttribute('lang', 'ar');
  await expect(html).toHaveAttribute('dir', 'rtl');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});
