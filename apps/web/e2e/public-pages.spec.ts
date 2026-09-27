import { expect, test } from '@playwright/test';
import { ogImageName, PUBLIC_PAGES } from '../src/config/public-pages';

const LOCALES = ['ar', 'en'] as const;
const ORIGIN = 'https://startupbrandname.com';

/** Structured data types each page must publish, besides Organization and WebSite (M2b). */
const STRUCTURED_DATA: Record<(typeof PUBLIC_PAGES)[number]['id'], readonly string[]> = {
  home: ['WebPage', 'WebApplication'],
  howItWorks: ['HowTo', 'BreadcrumbList'],
  methodology: ['Article', 'BreadcrumbList'],
  pricing: ['WebApplication', 'BreadcrumbList'],
  glossary: ['DefinedTermSet', 'BreadcrumbList'],
  faq: ['FAQPage', 'BreadcrumbList'],
  about: ['AboutPage', 'BreadcrumbList'],
};

for (const locale of LOCALES) {
  for (const { id, path } of PUBLIC_PAGES) {
    test(`/${locale}${path || ''} is a complete public page`, async ({ page, request }) => {
      const response = await page.goto(`/${locale}${path}`);
      expect(response?.status()).toBe(200);

      await expect(page.locator('html')).toHaveAttribute('lang', locale);
      await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr');
      await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
      await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /.{40,}/);
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
        'href',
        `${ORIGIN}/${locale}${path}`,
      );

      // The share image exists and is the one for this page in this language.
      const image = await page.locator('meta[property="og:image"]').getAttribute('content');
      expect(image).toBe(`${ORIGIN}/og/${locale}/${ogImageName(id)}`);
      const file = await request.get(new URL(image ?? '').pathname);
      expect(file.status()).toBe(200);
      expect(file.headers()['content-type']).toBe('image/png');

      const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
      const types = blocks.map((block) => (JSON.parse(block) as { '@type': string })['@type']);
      expect(types).toEqual(
        expect.arrayContaining(['Organization', 'WebSite', ...STRUCTURED_DATA[id]]),
      );
    });
  }
}

test('inner pages lead back home through breadcrumbs', async ({ page }) => {
  await page.goto('/ar/glossary');
  const breadcrumbs = page.getByRole('navigation', { name: 'مسار التنقّل' });

  await expect(breadcrumbs.getByText('مسرد مصطلحات نموذج العمل')).toHaveAttribute(
    'aria-current',
    'page',
  );
  await breadcrumbs.getByRole('link', { name: 'الرئيسية' }).click();
  await expect(page).toHaveURL(/\/ar$/);
});

test('every public page is reachable from the footer', async ({ page }) => {
  await page.goto('/en');
  const footer = page.getByRole('navigation', { name: 'Platform pages' });

  for (const { path } of PUBLIC_PAGES.filter((candidate) => candidate.path !== '')) {
    await expect(footer.locator(`a[href="/en${path}"]`)).toHaveCount(1);
  }
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 360, height: 800 } });

  test('the header links fold into a menu that opens, closes with Escape and on navigation', async ({
    page,
  }) => {
    await page.goto('/ar');
    const button = page.getByRole('button', { name: 'القائمة' });
    const pricing = page.getByRole('navigation', { name: 'التنقّل الرئيسي' }).getByRole('link', {
      name: 'الأسعار',
    });

    await expect(button).toHaveAttribute('aria-expanded', 'false');
    await expect(pricing).toBeHidden();

    await button.click();
    await expect(button).toHaveAttribute('aria-expanded', 'true');
    await expect(pricing).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(pricing).toBeHidden();
    await expect(button).toBeFocused();

    await button.click();
    await pricing.click();
    await expect(page).toHaveURL(/\/ar\/pricing$/);
    await expect(button).toHaveAttribute('aria-expanded', 'false');
  });

  test('the pricing table becomes one plan at a time', async ({ page }) => {
    await page.goto('/en/pricing');

    await expect(page.getByRole('table', { name: 'Plan comparison' })).toBeHidden();
    const tabs = page.getByRole('tablist', { name: 'Choose a plan to see its details' });
    await expect(tabs.getByRole('tab', { name: 'Annual' })).toHaveAttribute(
      'aria-selected',
      'true',
    );

    await tabs.getByRole('tab', { name: 'Free' }).click();
    await expect(page.getByRole('tabpanel').getByText('3 a day')).toBeVisible();
  });

  test('pages never scroll sideways', async ({ page }) => {
    for (const { path } of PUBLIC_PAGES) {
      await page.goto(`/ar${path}`);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `/ar${path}`).toBeLessThanOrEqual(0);
    }
  });
});

test('the sitemap lists every public page in both languages', async ({ request }) => {
  const sitemap = await (await request.get('/sitemap.xml')).text();

  for (const locale of LOCALES) {
    for (const { path } of PUBLIC_PAGES) {
      expect(sitemap).toContain(`<loc>${ORIGIN}/${locale}${path}</loc>`);
    }
  }
});

test('llms.txt summarises the platform for AI answer engines', async ({ request }) => {
  const response = await request.get('/llms.txt');

  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toContain('text/plain');
  expect(await response.text()).toMatch(/^# Startup Brand Name/);
});

test('the share image source page stays out of search results', async ({ page }) => {
  await page.goto('/en/og-card/pricing');

  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
});
