import { expect, test } from '@playwright/test';

// The report on screen, checked on its gallery (M5 step 5b, D-275, D-276): the gallery builds the
// same model from fixtures, so no database is needed. The real route is in e2e/auth/report.spec.ts.
const GALLERY = '/ar/design/report';

test.describe('the verdict reveal', () => {
  test('has no animation under reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(GALLERY);

    const slab = page.locator('[data-report-reveal]');
    await expect(slab).toBeVisible();
    const names = await slab.evaluate((element) => ({
      slab: getComputedStyle(element).animationName,
      word: getComputedStyle(element.querySelector('.verdict-word') ?? element).animationName,
      running: element.getAnimations({ subtree: true }).length,
    }));
    expect(names).toEqual({ slab: 'none', word: 'none', running: 0 });
  });

  test('plays once and ends in the final position without it', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto(GALLERY);

    const slab = page.locator('[data-report-reveal]');
    await expect(slab).toBeVisible();
    // The animation exists on the slab and on its word.
    const before = await slab.evaluate((element) => ({
      slab: getComputedStyle(element).animationName,
      word: getComputedStyle(element.querySelector('.verdict-word') ?? element).animationName,
    }));
    expect(before).toEqual({ slab: 'sbn-report-reveal', word: 'sbn-report-settle' });

    // It ends: uncovered from edge to edge, the word in its place, and the slab has the same size
    // as at the start (the motion never moves the page).
    const heightAtStart = await slab.evaluate((element) => element.getBoundingClientRect().height);
    await slab.evaluate(async (element) => {
      await Promise.all(element.getAnimations({ subtree: true }).map((a) => a.finished));
    });
    const after = await slab.evaluate((element) => ({
      clip: getComputedStyle(element).clipPath,
      transform: getComputedStyle(element.querySelector('.verdict-word') ?? element).transform,
      height: element.getBoundingClientRect().height,
    }));
    expect(after.clip).toMatch(/^inset\(0(px|%)?( 0(px|%)?){0,3}\)$/);
    // While an animation holds its end state the computed transform is the identity matrix.
    expect(after.transform).toMatch(/^(none|matrix\(1, 0, 0, 1, 0, 0\))$/);
    expect(after.height).toBe(heightAtStart);
  });
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 360, height: 800 } });

  test('the page does not scroll sideways while a wide table scrolls in its own region', async ({
    page,
  }) => {
    await page.goto('/en/design/report');
    await page.evaluate(() => document.fonts.ready);

    const page_ = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      client: document.documentElement.clientWidth,
    }));
    expect(page_.scroll).toBeLessThanOrEqual(page_.client);

    const regions = page.locator('[role="region"][tabindex="0"]');
    const scrolling = await regions.evaluateAll(
      (nodes) => nodes.filter((node) => node.scrollWidth > node.clientWidth + 1).length,
    );
    expect(scrolling).toBeGreaterThan(0);
    // Every such region is named, so a screen reader announces which table it is.
    const unnamed = await regions.evaluateAll(
      (nodes) => nodes.filter((node) => !node.getAttribute('aria-labelledby')).length,
    );
    expect(unnamed).toBe(0);
  });

  test('the contents list is a disclosure, not the sticky column', async ({ page }) => {
    await page.goto('/en/design/report');
    await expect(page.locator('details > summary')).toBeVisible();
    await expect(page.locator('aside nav')).toBeHidden();
    await page.locator('details > summary').click();
    await expect(page.locator('details nav a').first()).toBeVisible();
  });
});

test('the contents list is a column beside the report on a wide screen', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/en/design/report');
  await expect(page.locator('aside nav a').first()).toBeVisible();
  await expect(page.locator('details > summary')).toBeHidden();
});

test('a summary locked by the plan shows the verdict word, titles and the way on (D-278)', async ({
  page,
}) => {
  await page.goto('/en/design/report?view=plan');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.locator('[data-report-reveal] .verdict-word')).toHaveText('Revise');
  await expect(page.locator('[data-report-reveal] [role="meter"]')).toHaveCount(0);
  await expect(page.getByText('opens with a paid package', { exact: false }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'See packages and prices' }).first()).toBeVisible();
});

test('a summary with no calculation has no verdict at all', async ({ page }) => {
  await page.goto('/en/design/report?view=nocalc');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.locator('[data-report-reveal]')).toHaveCount(0);
});

// The result region of the project page (D-286, D-287), on its gallery view: the verdict is drawn
// still, a stop keeps its sentence and its three changes, and the other three states say in words
// what is missing.
test('the project page result shows the verdict still and the other states in words', async ({
  page,
}) => {
  await page.goto('/en/design/report?project=jo-home-ecommerce&view=result');
  const regions = page.getByRole('region', { name: 'Check result' });
  await expect(regions).toHaveCount(4);

  // A stop: the slab with no reveal motion (that belongs to the report page), and its three changes.
  await expect(regions.nth(0).locator('[data-verdict="stop"] .verdict-word')).toHaveText('Stop');
  await expect(page.locator('[data-report-reveal]')).toHaveCount(0);
  await expect(regions.nth(0).locator('table tbody tr')).toHaveCount(3);

  // The answers are enough but the numbers are not calculated: what to give, a link to each.
  await expect(regions.nth(1).getByText('The numbers are not calculated yet')).toBeVisible();
  await expect(regions.nth(1).getByRole('link')).toHaveCount(2);

  // Below the gate, and a failure: one plain statement each, never a verdict.
  await expect(
    regions.nth(2).getByText('Your answers are not enough for a report yet'),
  ).toBeVisible();
  await expect(regions.nth(3).getByRole('note')).toContainText('We could not calculate');
  await expect(page.locator('[data-verdict]')).toHaveCount(1);
});

test('the three projects show their three verdicts', async ({ page }) => {
  for (const [project, word] of [
    ['jo-service-subscription', 'Revise'],
    ['dz-auto-entrepreneur', 'Go'],
    ['jo-home-ecommerce', 'Stop'],
  ] as const) {
    await page.goto(`/en/design/report?project=${project}`);
    await expect(page.locator('[data-report-reveal] .verdict-word')).toHaveText(word);
  }
});
