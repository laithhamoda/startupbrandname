import { expect, type Page } from '@playwright/test';

// Local Supabase catches every email in Mailpit instead of sending it.
export const MAILPIT_URL = process.env.MAILPIT_URL ?? 'http://127.0.0.1:54324';

/** A fresh address per test, so tests never share an account or an inbox. */
export function uniqueEmail(label: string): string {
  return `${label}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}@example.test`;
}

interface MailpitSearch {
  messages: { ID: string; Created: string }[];
}

interface MailpitMessage {
  Text: string;
  HTML: string;
}

/** Waits for the newest email to `email` and returns the 6-digit code in it. */
export async function readCode(page: Page, email: string, after = 0): Promise<string> {
  let code = '';
  await expect
    .poll(
      async () => {
        const search = await page.request.get(`${MAILPIT_URL}/api/v1/search`, {
          params: { query: `to:"${email}"` },
        });
        const { messages } = (await search.json()) as MailpitSearch;
        if (messages.length <= after) return false;
        const newest = [...messages].sort((a, b) => b.Created.localeCompare(a.Created))[0];
        if (!newest) return false;
        const message = (await (
          await page.request.get(`${MAILPIT_URL}/api/v1/message/${newest.ID}`)
        ).json()) as MailpitMessage;
        // Strip tags first so colours such as #111111 in inline styles are not taken for the code.
        const text = message.Text || message.HTML.replace(/<[^>]*>/g, ' ');
        code = /\b(\d{6})\b/.exec(text)?.[1] ?? '';
        return code !== '';
      },
      { timeout: 20_000, message: `a sign-in code for ${email}` },
    )
    .toBe(true);
  return code;
}

export async function countEmails(page: Page, email: string): Promise<number> {
  const search = await page.request.get(`${MAILPIT_URL}/api/v1/search`, {
    params: { query: `to:"${email}"` },
  });
  return ((await search.json()) as MailpitSearch).messages.length;
}

type Answer = 'نعم' | 'لا';

interface Declarations {
  secondary?: Answer;
  adult?: Answer;
  crossborder?: boolean;
}

/** Fills the Arabic signup step 1. */
export async function answerDeclarations(
  page: Page,
  { secondary = 'نعم', adult = 'نعم', crossborder = false }: Declarations = {},
) {
  await page.getByLabel('بلد إقامتك').selectOption('JO');
  await page
    .getByRole('radiogroup', { name: /المرحلة الثانوية/ })
    .getByRole('radio', { name: secondary })
    .check();
  await page
    .getByRole('radiogroup', { name: /18 سنة/ })
    .getByRole('radio', { name: adult })
    .check();
  await page.getByRole('checkbox', { name: /شروط الاستخدام/ }).check();
  if (crossborder) await page.getByRole('checkbox', { name: /Anthropic/ }).check();
  await page.getByRole('button', { name: 'متابعة' }).click();
}

/** Signup by email code in Arabic, from the first step to the projects page. */
export async function signUpByEmail(page: Page, email: string, crossborder = false) {
  await page.goto('/ar/signup');
  await answerDeclarations(page, { crossborder });
  await page.getByLabel('البريد الإلكتروني').fill(email);
  await page.getByRole('button', { name: 'أرسل الرمز' }).click();
  await page.getByLabel('رمز الدخول').fill(await readCode(page, email));
  await page.getByRole('button', { name: 'تحقّق وادخل' }).click();
  await expect(page).toHaveURL(/\/ar\/projects$/);
}

/** Sign-in by email code for an existing account. */
export async function signInByEmail(page: Page, email: string) {
  const before = await countEmails(page, email);
  await page.goto('/ar/login');
  await page.getByLabel('البريد الإلكتروني').fill(email);
  await page.getByRole('button', { name: 'أرسل الرمز' }).click();
  await page.getByLabel('رمز الدخول').fill(await readCode(page, email, before));
  await page.getByRole('button', { name: 'تحقّق وادخل' }).click();
}
