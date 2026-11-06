import { expect, test } from '@playwright/test';

const ORIGIN = 'https://startupbrandname.com';

// D-337: one English page for AI assistants at a prefix-free address. It must be readable from the
// raw HTML, without JavaScript and without signing in.
test('/ai-context answers 200 and its text is in the raw HTML', async ({ request }) => {
  const response = await request.get('/ai-context', { maxRedirects: 0 });

  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toContain('text/html');
  const html = await response.text();
  expect(html).toContain('<html lang="en"');
  for (const heading of [
    '1. Platform overview',
    '2. Features and capabilities',
    '3. User journey',
    '5. Business model',
    '7. AI capabilities',
    '9. Current development status',
  ]) {
    expect(html, heading).toContain(heading);
  }
  expect(html).toContain('Status: Planned, not built');
  expect(html).toContain('application/ld+json');
  expect(html).toContain(`${ORIGIN}/ai-context#webpage`);
  expect(html).toMatch(/<link rel="canonical" href="[^"]*\/ai-context"/);
});

test('/ai-context exposes no secret or configuration name', async ({ request }) => {
  const html = await (await request.get('/ai-context')).text();

  for (const forbidden of [/sk-ant/i, /sb_secret/i, /PADDLE_[A-Z_]+/, /SUPABASE_[A-Z_]+/]) {
    expect(html, String(forbidden)).not.toMatch(forbidden);
  }
});

test('the other addresses of the page go to the one address', async ({ request }) => {
  for (const path of ['/ar/ai-context', '/en/ai-context']) {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.status(), path).toBe(308);
    expect(new URL(response.headers().location ?? '', ORIGIN).pathname, path).toBe('/ai-context');
  }
});

test('the sitemap and llms.txt list the page', async ({ request }) => {
  expect(await (await request.get('/sitemap.xml')).text()).toContain(
    `<loc>${ORIGIN}/ai-context</loc>`,
  );
  expect(await (await request.get('/llms.txt')).text()).toContain(`(${ORIGIN}/ai-context)`);
});

test('the page does not scroll sideways on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/ai-context');

  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
