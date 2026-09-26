'use server';

import type { AuthError } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { CROSSBORDER_VERSION } from '@/config/legal';
import { getServerEnv } from '@/env/server';
import { type Locale, routing } from '@/i18n/routing';
import { COUNTRY_CODES } from '@/lib/countries';
import { closedCountries } from '@/lib/markets';
import { createSupabaseServerClient, type SupabaseServerClient } from '@/lib/supabase/server';
import { type EligibilityField, parseEligibility, type Refusal, refusalOf } from './eligibility';
import { projectsPath } from './next-path';
import { completeOnboarding, finishSignIn, getSessionUser, saveSignupIntent } from './session';
import { SIGNUP_INTENT_COOKIE } from './signup-intent';

// Every action receives the page locale explicitly: Server Actions cannot read the [locale]
// segment. Results carry codes, never text; the forms translate them.

export type AuthErrorCode =
  'invalidEmail' | 'invalidCode' | 'rateLimited' | 'failed' | 'signupExpired' | 'eligibility';

export type AuthFormState =
  | { status: 'idle' }
  | { status: 'sent'; email: string }
  | { status: 'error'; error: AuthErrorCode; invalid?: EligibilityField[] }
  | { status: 'refused'; refusal: Refusal; deleted: boolean }
  | { status: 'closed'; deleted: boolean };

const localeSchema = z.enum(routing.locales);
const emailSchema = z.string().trim().toLowerCase().max(254).pipe(z.email());
// The product uses 6-digit codes (Supabase "Email OTP length" = 6). Any length Supabase allows
// (6 to 10) is accepted, so a changed dashboard setting never locks people out.
const codeSchema = z
  .string()
  .transform((value) => value.replace(/\s/g, ''))
  .pipe(z.string().regex(/^\d{6,10}$/));

function parseLocale(value: unknown): Locale {
  return localeSchema.parse(value);
}

function errorCodeOf(error: AuthError): AuthErrorCode {
  if (error.status === 429 || error.code === 'over_email_send_rate_limit') return 'rateLimited';
  // Supabase uses otp_expired for a wrong code too ("Token has expired or is invalid").
  if (error.code === 'otp_expired') return 'invalidCode';
  if (error.code === 'validation_failed' || error.code === 'email_address_invalid') {
    return 'invalidEmail';
  }
  return 'failed';
}

async function siteOrigin(): Promise<string> {
  const requestHeaders = await headers();
  const host = requestHeaders.get('x-forwarded-host') ?? requestHeaders.get('host');
  const protocol = requestHeaders.get('x-forwarded-proto') ?? 'http';
  if (!host) throw new Error('Cannot build the sign-in callback URL without a Host header.');
  // Supabase only redirects to URLs on its allow list, so a forged Host cannot hijack the flow.
  return `${protocol}://${host}`;
}

/**
 * Checks the declarations sent with a signup request. Nothing is stored for a refusal or a closed
 * country; otherwise the answers are kept in a short-lived cookie until the account exists.
 */
async function acceptSignupAnswers(
  locale: Locale,
  formData: FormData,
): Promise<AuthFormState | null> {
  const parsed = parseEligibility(formData);
  if (!parsed.ok) return { status: 'error', error: 'eligibility', invalid: parsed.invalid };
  const refusal = refusalOf(parsed.answers);
  if (refusal) return { status: 'refused', refusal, deleted: false };
  if (closedCountries(getServerEnv()).includes(parsed.answers.country)) {
    return { status: 'closed', deleted: false };
  }
  await saveSignupIntent({
    country: parsed.answers.country,
    locale,
    crossborder: parsed.answers.crossborder === 'on',
  });
  return null;
}

async function forgetSignupAnswers(): Promise<void> {
  (await cookies()).delete(SIGNUP_INTENT_COOKIE);
}

/**
 * Ends the session of an account that was just deleted. signOut() can fail for a user who no
 * longer exists, and a leftover token would still verify until it expires, so the session
 * cookies are removed here whatever signOut() answers.
 */
async function endDeletedSession(supabase: SupabaseServerClient): Promise<void> {
  await supabase.auth.signOut({ scope: 'local' });
  const cookieStore = await cookies();
  for (const { name } of cookieStore.getAll()) {
    if (name.startsWith('sb-')) cookieStore.delete(name);
  }
}

// -----------------------------------------------------------------------------------------------
// Email code
// -----------------------------------------------------------------------------------------------

/** Signup, step 2: validates the declarations again, then emails a 6-digit code. */
export async function requestSignupCode(
  localeInput: Locale,
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const locale = parseLocale(localeInput);
  const email = emailSchema.safeParse(formData.get('email'));
  if (!email.success) return { status: 'error', error: 'invalidEmail' };

  const rejected = await acceptSignupAnswers(locale, formData);
  if (rejected) return rejected;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: email.data,
    // The locale picks the language of the email (supabase/templates/code.html).
    options: { shouldCreateUser: true, data: { locale } },
  });
  if (error) return { status: 'error', error: errorCodeOf(error) };
  return { status: 'sent', email: email.data };
}

/** Sign-in: emails a code to an existing account. Never reveals whether the account exists. */
export async function requestLoginCode(
  localeInput: Locale,
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  parseLocale(localeInput);
  const email = emailSchema.safeParse(formData.get('email'));
  if (!email.success) return { status: 'error', error: 'invalidEmail' };

  await forgetSignupAnswers();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: email.data,
    options: { shouldCreateUser: false },
  });
  // An unknown email fails with "signups not allowed"; answering "sent" either way stops anyone
  // from checking which addresses have an account.
  if (error && errorCodeOf(error) === 'rateLimited') {
    return { status: 'error', error: 'rateLimited' };
  }
  return { status: 'sent', email: email.data };
}

/** Last step for both: checks the code, finishes onboarding if answered, then goes on. */
export async function verifyEmailCode(
  localeInput: Locale,
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const locale = parseLocale(localeInput);
  const email = emailSchema.safeParse(formData.get('email'));
  if (!email.success) return { status: 'error', error: 'invalidEmail' };
  const code = codeSchema.safeParse(formData.get('code'));
  if (!code.success) return { status: 'error', error: 'invalidCode' };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.verifyOtp({
    email: email.data,
    token: code.data,
    type: 'email',
  });
  if (error) {
    const reason = errorCodeOf(error);
    return { status: 'error', error: reason === 'failed' ? 'invalidCode' : reason };
  }
  redirect(await finishSignIn(supabase, locale));
}

// -----------------------------------------------------------------------------------------------
// Google
// -----------------------------------------------------------------------------------------------

async function redirectToGoogle(locale: Locale): Promise<AuthFormState> {
  // The button is hidden when Google is off; a crafted request gets an error, not Supabase's page.
  if (!getServerEnv().AUTH_GOOGLE_ENABLED) return { status: 'error', error: 'failed' };
  const supabase = await createSupabaseServerClient();
  const next = encodeURIComponent(projectsPath(locale));
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${await siteOrigin()}/auth/callback?next=${next}`,
      // Basic profile only (D-065): openid, email and profile are Supabase's defaults.
      queryParams: { prompt: 'select_account' },
    },
  });
  if (error) return { status: 'error', error: 'failed' };
  redirect(data.url);
}

/** Signup with Google, after the declarations: they are recorded when Google sends the user back. */
export async function startGoogleSignup(
  localeInput: Locale,
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const locale = parseLocale(localeInput);
  const rejected = await acceptSignupAnswers(locale, formData);
  if (rejected) return rejected;
  return redirectToGoogle(locale);
}

/** Sign-in with Google. A new Google account lands on the onboarding gate (D-065). */
export async function startGoogleLogin(localeInput: Locale): Promise<AuthFormState> {
  const locale = parseLocale(localeInput);
  await forgetSignupAnswers();
  return redirectToGoogle(locale);
}

// -----------------------------------------------------------------------------------------------
// Onboarding gate
// -----------------------------------------------------------------------------------------------

/**
 * For a signed-in account without declarations (typically created through Google). A "no", or a
 * country where signup is closed, deletes the account at once.
 */
export async function submitOnboarding(
  localeInput: Locale,
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const locale = parseLocale(localeInput);
  const parsed = parseEligibility(formData);
  if (!parsed.ok) return { status: 'error', error: 'eligibility', invalid: parsed.invalid };

  const supabase = await createSupabaseServerClient();
  if (!(await getSessionUser(supabase))) redirect(`/${locale}/login`);

  // After a deletion the user is signed out, so the answer is shown on its own page: the gate
  // re-renders after the cookies change and would send a signed-out visitor to sign-in.
  const { answers } = parsed;
  if (!refusalOf(answers) && closedCountries(getServerEnv()).includes(answers.country)) {
    const { error } = await supabase.rpc('delete_my_account');
    if (error) throw error;
    await endDeletedSession(supabase);
    redirect(`/${locale}/not-eligible?reason=closed`);
  }

  const result = await completeOnboarding(supabase, {
    country: answers.country,
    locale,
    secondary: answers.secondary === 'yes',
    adult: answers.adult === 'yes',
    crossborder: answers.crossborder === 'on',
  });
  if (result === 'refused') {
    // The database has already deleted the account; clear the session cookies.
    await endDeletedSession(supabase);
    redirect(`/${locale}/not-eligible?reason=${refusalOf(answers) ?? 'adult'}`);
  }
  redirect(projectsPath(locale));
}

// -----------------------------------------------------------------------------------------------
// Account
// -----------------------------------------------------------------------------------------------

export type AccountFormState = { status: 'idle' } | { status: 'saved' } | { status: 'error' };

const preferencesSchema = z.object({
  country: z.enum(COUNTRY_CODES),
  language: localeSchema,
});

export async function updatePreferences(
  localeInput: Locale,
  _previous: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  const locale = parseLocale(localeInput);
  const parsed = preferencesSchema.safeParse({
    country: formData.get('country'),
    language: formData.get('language'),
  });
  if (!parsed.success) return { status: 'error' };

  const supabase = await createSupabaseServerClient();
  const user = await getSessionUser(supabase);
  if (!user) redirect(`/${locale}/login`);

  const { error } = await supabase
    .from('profiles')
    .update({ country_code: parsed.data.country, locale: parsed.data.language })
    .eq('user_id', user.id);
  if (error) return { status: 'error' };
  // Sign-in emails read the language from the auth user's metadata.
  await supabase.auth.updateUser({ data: { locale: parsed.data.language } });

  if (parsed.data.language !== locale) redirect(`/${parsed.data.language}/account`);
  revalidatePath(`/${locale}/account`);
  return { status: 'saved' };
}

export async function setCrossborderConsent(localeInput: Locale, given: boolean): Promise<void> {
  const locale = parseLocale(localeInput);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('set_crossborder_consent', {
    p_given: z.boolean().parse(given),
    p_text_version: CROSSBORDER_VERSION,
  });
  if (error) throw error;
  revalidatePath(`/${locale}/account`);
}

export async function signOut(localeInput: Locale): Promise<void> {
  const locale = parseLocale(localeInput);
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect(`/${locale}`);
}

export async function deleteAccount(localeInput: Locale): Promise<void> {
  const locale = parseLocale(localeInput);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('delete_my_account');
  if (error) throw error;
  await endDeletedSession(supabase);
  redirect(`/${locale}/goodbye`);
}
