import 'server-only';
import { cookies, headers } from 'next/headers';
import { redirect, unstable_rethrow } from 'next/navigation';
import { cache } from 'react';
import { z } from 'zod';
import { TERMS_VERSION, CROSSBORDER_VERSION } from '@/config/legal';
import { getServerEnv } from '@/env/server';
import type { Locale } from '@/i18n/routing';
import type { CountryCode } from '@/lib/countries';
import { errorFields, log } from '@/lib/log';
import { closedCountries } from '@/lib/markets';
import { createSupabaseServerClient, type SupabaseServerClient } from '@/lib/supabase/server';
import { loginPath, PATH_HEADER, projectsPath } from './next-path';
import {
  parseSignupIntent,
  serializeSignupIntent,
  SIGNUP_INTENT_COOKIE,
  SIGNUP_INTENT_MAX_AGE_SECONDS,
  type SignupIntent,
} from './signup-intent';

export interface SessionUser {
  id: string;
  email: string | null;
  /** Names from the sign-in profile, removed from every text sent to a model (rule 5, D-148). */
  names: string[];
}

export interface Profile {
  country_code: string;
  locale: string;
}

/** The profile fields that may hold the founder's name; Google sign-in fills some of them. */
const NAME_FIELDS = ['full_name', 'name', 'given_name', 'family_name'] as const;
const profileName = z.string().trim().min(1).max(200);

/** The distinct names in a session token's user metadata. */
export function profileNames(metadata: unknown): string[] {
  if (typeof metadata !== 'object' || metadata === null) return [];
  const names = NAME_FIELDS.flatMap((field) => {
    const name = profileName.safeParse((metadata as Record<string, unknown>)[field]);
    return name.success ? [name.data] : [];
  });
  return [...new Set(names)];
}

/** The signed-in user from the verified session token, or null. */
export async function getSessionUser(supabase: SupabaseServerClient): Promise<SessionUser | null> {
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims) return null;
  return {
    id: claims.sub,
    email: typeof claims.email === 'string' ? claims.email : null,
    names: profileNames(claims.user_metadata),
  };
}

/** The user's profile, which exists only once onboarding is complete. */
export async function getProfile(supabase: SupabaseServerClient): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('country_code, locale')
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * For pages behind sign-in: redirects to sign-in, or to the onboarding gate if incomplete.
 * Sign-in comes back to the page asked for (a deep link, or a session that expired mid-answer).
 * Layouts and pages both call it (a layout check alone does not protect a page); `cache` makes
 * that one check per request.
 */
export const requireAccount = cache(async (locale: Locale) => {
  const supabase = await createSupabaseServerClient();
  const user = await getSessionUser(supabase);
  if (!user) redirect(loginPath(locale, (await headers()).get(PATH_HEADER)));
  const profile = await getProfile(supabase);
  if (!profile) redirect(`/${locale}/onboarding`);
  return { supabase, user, profile };
});

/**
 * For the sign-in and sign-up pages: a signed-in visitor goes to `next` (already checked by
 * safeNextPath), by default their projects, instead.
 */
export async function redirectIfSignedIn(
  locale: Locale,
  next: string = projectsPath(locale),
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  if (await getSessionUser(supabase)) redirect(next);
}

// -----------------------------------------------------------------------------------------------
// Onboarding
// -----------------------------------------------------------------------------------------------

const onboardingResult = z.enum(['completed', 'already_complete']);
export type OnboardingResult = z.infer<typeof onboardingResult> | 'closed';

/**
 * Records the onboarding answers and consents for the signed-in user (complete_onboarding()).
 * For a country where signup is closed (lib/markets.ts) nothing is recorded and the result is
 * 'closed', whichever way the answers arrived (the gate form or the signup cookie); the caller
 * then deletes the new account. An account that already has a profile is left alone, as
 * complete_onboarding() itself would.
 */
export async function completeOnboarding(
  supabase: SupabaseServerClient,
  answers: {
    country: CountryCode;
    locale: Locale;
    hasProject: boolean;
    crossborder: boolean;
  },
): Promise<OnboardingResult> {
  if (closedCountries(getServerEnv()).includes(answers.country)) {
    return (await getProfile(supabase)) ? 'already_complete' : 'closed';
  }
  const { data, error } = await supabase.rpc('complete_onboarding', {
    p_country_code: answers.country,
    p_locale: answers.locale,
    p_has_project: answers.hasProject,
    p_terms_version: TERMS_VERSION,
    p_crossborder_consent: answers.crossborder,
    p_crossborder_version: CROSSBORDER_VERSION,
  });
  if (error) throw error;
  return onboardingResult.parse(data);
}

export async function saveSignupIntent(intent: SignupIntent): Promise<void> {
  (await cookies()).set(SIGNUP_INTENT_COOKIE, serializeSignupIntent(intent), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.VERCEL === '1',
    path: '/',
    maxAge: SIGNUP_INTENT_MAX_AGE_SECONDS,
  });
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

/**
 * Deletes the signed-in account and everything linked to it, then ends its session. Returns
 * false, after logging why, when the database refuses; nothing is deleted then.
 */
export async function deleteSignedInAccount(
  supabase: SupabaseServerClient,
  reason: 'requested' | 'closed_market',
): Promise<boolean> {
  const { error } = await supabase.rpc('delete_my_account');
  if (error) {
    await log.error('account.delete_failed', { ...errorFields(error), reason });
    return false;
  }
  await endDeletedSession(supabase);
  return true;
}

/** Where a signed-out visitor from a closed country is told why (D-068). */
export function notAvailablePath(locale: Locale): string {
  return `/${locale}/not-available`;
}

/**
 * Right after sign-in: if this browser answered the first signup step before the account existed,
 * record the answers now and forget them. Returns where the user should go next.
 * It never fails: the one-time code or Google's code is already used, so an error here would
 * strand the founder. Without a profile, the signed-in pages send them to the onboarding gate,
 * which asks the same questions again.
 */
export async function finishSignIn(
  supabase: SupabaseServerClient,
  locale: Locale,
  next: string = projectsPath(locale),
): Promise<string> {
  const cookieStore = await cookies();
  const intent = parseSignupIntent(cookieStore.get(SIGNUP_INTENT_COOKIE)?.value);
  if (!intent) return next;
  // Read once, whatever happens next.
  cookieStore.delete(SIGNUP_INTENT_COOKIE);
  try {
    const result = await completeOnboarding(supabase, {
      country: intent.country,
      locale: intent.locale,
      hasProject: intent.hasProject,
      crossborder: intent.crossborder,
    });
    if (result === 'closed' && (await deleteSignedInAccount(supabase, 'closed_market'))) {
      return notAvailablePath(locale);
    }
  } catch (error) {
    unstable_rethrow(error);
    await log.error('auth.onboarding_failed', { ...errorFields(error), stage: 'sign_in' });
  }
  return next;
}
