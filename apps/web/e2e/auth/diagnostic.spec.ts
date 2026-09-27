import AxeBuilder from '@axe-core/playwright';
import { QUESTIONS } from '@sbn/question-bank';
import { expect, type Page, test } from '@playwright/test';
import { signInByEmail, signUpByEmail, uniqueEmail } from './helpers';

const DONT_KNOW = 'لا أعرف (يُحفظ افتراضًا)';
const NEXT = 'التالي';

/** Creates a project from "My projects" and returns its ID; lands on the first question. */
async function createProject(page: Page, mode: 'quick' | 'full'): Promise<string> {
  await page.goto('/ar/projects');
  await page.getByRole('link', { name: 'مشروع جديد' }).click();
  await page.getByLabel('اسم المشروع').fill('صيانة مكيّفات المطاعم');
  await page.getByLabel('عملة المشروع').selectOption('JOD');
  await page.getByRole('radio', { name: mode === 'quick' ? /السريعة/ : /الكاملة/ }).click();
  await page.getByRole('button', { name: 'أنشئ المشروع وابدأ' }).click();
  await expect(page).toHaveURL(/\/ar\/projects\/[0-9a-f-]{36}\/q\/A1$/);
  return /projects\/([0-9a-f-]{36})/.exec(page.url())?.[1] ?? '';
}

async function next(page: Page, step: string) {
  await page.getByRole('button', { name: NEXT }).click();
  await expect(page).toHaveURL(new RegExp(`/q/${step}$`));
}

async function dontKnow(page: Page, step: string) {
  await page.getByRole('button', { name: DONT_KNOW }).click();
  await expect(page).toHaveURL(
    new RegExp(step === 'overview' ? '/projects/[0-9a-f-]{36}$' : `/q/${step}$`),
  );
}

test('a founder answers the quick diagnostic and unlocks the one-page summary', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await signUpByEmail(page, uniqueEmail('quick'));
  await createProject(page, 'quick');

  // A1: the country starts as the project's; the city is typed.
  await page.getByLabel('المدينة').fill('إربد');
  await next(page, 'A8');
  await page.getByRole('radio', { name: 'دخل رئيسي' }).click();
  await next(page, 'B1');

  // B1 must be one sentence (SPEC §1): rejected in place, what was typed is kept.
  const idea = page.getByRole('textbox', { name: /صف فكرتك في جملة واحدة/ });
  await idea.fill('صيانة للمطاعم. وأيضًا للفنادق.');
  await page.getByRole('button', { name: NEXT }).click();
  await expect(page.getByText('في جملة واحدة فقط، من فضلك.')).toBeVisible();
  await expect(idea).toHaveValue('صيانة للمطاعم. وأيضًا للفنادق.');
  await idea.fill('صيانة دورية لمكيّفات المطاعم الصغيرة في إربد لأن الأعطال توقف المطبخ.');
  await next(page, 'B2');

  // «لا أعرف» everywhere it is allowed; the structural questions get a real answer.
  await dontKnow(page, 'B4');
  await dontKnow(page, 'C1');
  await page.getByRole('radio', { name: 'شركات' }).click();
  await next(page, 'C2');
  for (const [step, following] of [
    ['C2', 'C8'],
    ['C8', 'D1'],
    ['D1', 'D3'],
    ['D3', 'D4'],
    ['D4', 'E1'],
    ['E1', 'F1'],
    ['F1', 'F3'],
    ['F3', 'F4'],
    ['F4', 'F5'],
    ['F5', 'F6'],
    ['F6', 'G6'],
    ['G6', 'H1'],
    ['H1', 'H8'],
  ] as const) {
    await expect(page).toHaveURL(new RegExp(`/q/${step}$`));
    await dontKnow(page, following);
  }
  await page.getByRole('radio', { name: 'لي وحدي' }).click();
  await page.getByRole('button', { name: NEXT }).click();

  // The 20 ★ questions give 53% (D-102): the summary is unlocked, the full report is not.
  await expect(page).toHaveURL(/\/ar\/projects\/[0-9a-f-]{36}$/);
  await expect(page.getByText('53%')).toBeVisible();
  await expect(page.getByText(/الملخّص في صفحة واحدة: من 40%\. متاح\./)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'مهام التحقّق' })).toBeVisible();
});

test('answer rules speak in place, and a picked range or «لا أعرف» is saved', async ({ page }) => {
  await signUpByEmail(page, uniqueEmail('rules'));
  const id = await createProject(page, 'full');

  // R1 on B3.
  await page.goto(`/ar/projects/${id}/q/B3`);
  await page.getByRole('textbox').fill('الجميع');
  await page.getByRole('button', { name: NEXT }).click();
  await expect(page.getByText(/المشروع الذي يستهدف الجميع لا يصل إلى أحد/)).toBeVisible();

  // R3 on A6: an unreadable number offers the ranges; picking one saves it as an assumption.
  await page.goto(`/ar/projects/${id}/q/A6`);
  await page.getByRole('textbox').fill('عشرين ساعة');
  await page.getByRole('button', { name: NEXT }).click();
  await page.getByRole('button', { name: '10–20' }).click();
  await expect(page).toHaveURL(/\/q\/A7$/);
  await page.goto(`/ar/projects/${id}/q/A6`);
  await expect(page.getByRole('textbox')).toHaveValue('15');

  // R4 on B4: "I don't know" typed as text is offered as «لا أعرف».
  await page.goto(`/ar/projects/${id}/q/B4`);
  await page.getByRole('textbox').fill('ما بعرف');
  await page.getByRole('button', { name: NEXT }).click();
  await page.getByRole('button', { name: 'احفظها «لا أعرف»' }).click();
  await expect(page).toHaveURL(/\/q\/B5$/);

  // F3 ≥ F1 is saved but blocks the calculations, and stays listed on the overview.
  await page.goto(`/ar/projects/${id}/q/F1`);
  await page.getByLabel('المبلغ').fill('20');
  await next(page, 'F2');
  await page.goto(`/ar/projects/${id}/q/F3`);
  await page.getByLabel('البند', { exact: true }).fill('قطع غيار');
  await page.getByLabel('المبلغ').fill('25');
  await page.getByRole('button', { name: NEXT }).click();
  await expect(page.getByText(/كل وحدة تبيعها تخسر فيها/)).toBeVisible();
  await page.getByRole('link', { name: 'متابعة' }).click();
  await expect(page).toHaveURL(/\/q\/F4$/);
  await page.goto(`/ar/projects/${id}`);
  await expect(page.getByText(/كل وحدة تبيعها تخسر فيها/)).toBeVisible();
});

test('all 64 questions render in Arabic and in English (M3 definition of done)', async ({
  page,
}) => {
  test.setTimeout(240_000);
  await signUpByEmail(page, uniqueEmail('all-questions'));
  const id = await createProject(page, 'full');

  for (const question of QUESTIONS) {
    await page.goto(`/ar/projects/${id}/q/${question.id}`);
    await expect(page.getByRole('heading', { level: 1 }), question.id).toHaveText(
      question.label.ar,
    );
    await page.goto(`/en/projects/${id}/q/${question.id}`);
    await expect(page.getByRole('heading', { level: 1 }), question.id).toHaveText(
      question.label.en,
    );
  }
});

test('the free plan allows one project, and deleting it frees the place', async ({ page }) => {
  await signUpByEmail(page, uniqueEmail('limit'));
  await createProject(page, 'quick');

  await page.goto('/ar/projects');
  await expect(page.getByRole('link', { name: 'مشروع جديد' })).toHaveCount(0);
  await expect(page.getByText(/الخطة المجانية تسمح بمشروع واحد/)).toBeVisible();

  // Going around the page still meets the database limit (D-109).
  await page.goto('/ar/projects/new');
  await page.getByLabel('اسم المشروع').fill('مشروع ثانٍ');
  await page.getByLabel('عملة المشروع').selectOption('USD');
  await page.getByRole('button', { name: 'أنشئ المشروع وابدأ' }).click();
  await expect(page.getByRole('alert').filter({ hasText: /بمشروع واحد/ })).toBeVisible();

  await page.goto('/ar/projects');
  await page.getByRole('link', { name: 'صيانة مكيّفات المطاعم' }).click();
  await page.getByRole('button', { name: 'احذف المشروع' }).click();
  await page.getByRole('button', { name: 'نعم، احذف المشروع' }).click();
  await expect(page).toHaveURL(/\/ar\/projects$/);
  await expect(page.getByRole('link', { name: 'مشروع جديد' })).toBeVisible();
});

test('answers survive signing out, and the diagnostic resumes where it stopped', async ({
  page,
}) => {
  // Supabase sends one code per address per minute, so this test waits out that minute.
  test.setTimeout(150_000);
  const email = uniqueEmail('resume');
  await signUpByEmail(page, email);
  await createProject(page, 'quick');
  await page.getByLabel('المدينة').fill('إربد');
  await next(page, 'A8');

  await page.goto('/ar/account');
  await page.getByRole('button', { name: 'تسجيل الخروج' }).click();
  await expect(page).toHaveURL(/\/ar$/);
  await page.waitForTimeout(61_000);
  await signInByEmail(page, email);

  await page.getByRole('link', { name: 'صيانة مكيّفات المطاعم' }).click();
  await page.getByRole('link', { name: 'تابع من حيث توقّفت' }).click();
  await expect(page).toHaveURL(/\/q\/A8$/);
  await page.goto(page.url().replace(/A8$/, 'A1'));
  await expect(page.getByLabel('المدينة')).toHaveValue('إربد');
});

// CI runs these with AI_PROVIDER=fake: a deterministic stand-in that knows a few dialect words
// (packages/ai/src/fake.ts), so no test calls the real model (D-123).
test('with consent, a dialect answer is confirmed, then saved in MSA (D-119)', async ({ page }) => {
  await signUpByEmail(page, uniqueEmail('ai-consent'), true);
  const id = await createProject(page, 'full');

  // B1: an idea too thin to follow is sent back (D-072).
  await page.goto(`/ar/projects/${id}/q/B1`);
  const idea = page.getByRole('textbox', { name: /صف فكرتك في جملة واحدة/ });
  await idea.fill('صيانة المكيّفات');
  await page.getByRole('button', { name: NEXT }).click();
  await expect(page.getByText(/لم تتضح الفكرة بعد/)).toBeVisible();

  // A dialect idea: the platform says what it understood and waits for a yes.
  await idea.fill('بدي أقدّم صيانة دورية لمكيّفات المطاعم الصغيرة');
  await page.getByRole('button', { name: NEXT }).click();
  await expect(page.getByText('هل فهمنا إجابتك كما تقصد؟')).toBeVisible();
  await expect(
    page.getByText('فهمت أن أريد أقدّم صيانة دورية لمكيّفات المطاعم الصغيرة'),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/q\/B1$/);
  await page.getByRole('button', { name: 'نعم، هذا صحيح' }).click();
  await expect(page).toHaveURL(/\/q\/B2$/);

  // "Edit" keeps the founder on the question with what they typed.
  const problem = page.getByRole('textbox');
  await problem.fill('المطاعم الصغيرة تعاني بزاف من أعطال المكيّفات في الصيف وتخسر زبائنها');
  await page.getByRole('button', { name: NEXT }).click();
  await page.getByRole('button', { name: 'تعديل الإجابة' }).click();
  await expect(page.getByText('هل فهمنا إجابتك كما تقصد؟')).toHaveCount(0);
  await expect(problem).toBeFocused();
  await expect(problem).toHaveValue(/تعاني بزاف/);
  await expect(page).toHaveURL(/\/q\/B2$/);

  // The saved idea is the confirmed MSA reading.
  await page.goto(`/ar/projects/${id}/q/B1`);
  await expect(idea).toHaveValue('أريد أقدّم صيانة دورية لمكيّفات المطاعم الصغيرة');
});

test('without consent, nothing is sent to the model and the answer is saved as typed (D-103)', async ({
  page,
}) => {
  await signUpByEmail(page, uniqueEmail('ai-no-consent'));
  const id = await createProject(page, 'full');

  await page.goto(`/ar/projects/${id}/q/B1`);
  const idea = page.getByRole('textbox', { name: /صف فكرتك في جملة واحدة/ });
  await idea.fill('بدي أقدّم صيانة دورية لمكيّفات المطاعم الصغيرة');
  await next(page, 'B2');
  await page.goto(`/ar/projects/${id}/q/B1`);
  await expect(idea).toHaveValue('بدي أقدّم صيانة دورية لمكيّفات المطاعم الصغيرة');
});

test('the diagnostic pages have no WCAG 2.2 AA violations', async ({ page }) => {
  await signUpByEmail(page, uniqueEmail('a11y-diagnostic'));
  const id = await createProject(page, 'full');
  const check = async () => {
    await page.evaluate(() => document.fonts.ready);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(results.violations.map((violation) => `${violation.id}: ${violation.help}`)).toEqual([]);
  };

  for (const path of [
    '/ar/projects',
    '/ar/projects/new',
    `/ar/projects/${id}`,
    `/en/projects/${id}`,
  ]) {
    await page.goto(path);
    await check();
  }
  for (const step of ['A1', 'A3', 'C2', 'D3', 'F3', 'G4']) {
    await page.goto(`/ar/projects/${id}/q/${step}`);
    await check();
  }
  // With a rule message shown.
  await page.goto(`/ar/projects/${id}/q/B3`);
  await page.getByRole('textbox').fill('الجميع');
  await page.getByRole('button', { name: NEXT }).click();
  await expect(page.getByText(/لا يصل إلى أحد/)).toBeVisible();
  await check();
});
