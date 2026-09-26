import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { z } from 'zod';
import { TERMS_VERSION, CROSSBORDER_VERSION } from '@/config/legal';
import type { Locale } from '@/i18n/routing';
import { createSupabaseServerClient, type SupabaseServerClient } from '@/lib/supabase/server';
import { projectsPath } from './next-path';
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
}

export interface Profile {
  country_code: string;
  locale: string;
}

/** The signed-in user from the verified session token, or null. */
export async function getSessionUser(supabase: SupabaseServerClient): Promise<SessionUser | null> {
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims) return null;
  return { id: claims.sub, email: typeof claims.email === 'string' ? claims.email : null };
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
 * Layouts and pages both call it (a layout check alone does not protect a page); `cache` makes
 * that one check per request.
 */
export const requireAccount = cache(async (locale: Locale) => {
  const supabase = await createSupabaseServerClient();
  const user = await getSessionUser(supabase);
  if (!user) redirect(`/${locale}/login`);
  const profile = await getProfile(supabase);
  if (!profile) redirect(`/${locale}/onboarding`);
  return { supabase, user, profile };
});

/** For the sign-in and sign-up pages: a signed-in visitor goes to their projects instead. */
export async function redirectIfSignedIn(locale: Locale): Promise<void> {
  const supabase = await createSupabaseServerClient();
  if (await getSessionUser(supabase)) redirect(projectsPath(locale));
}

// -----------------------------------------------------------------------------------------------
// Onboarding
// -----------------------------------------------------------------------------------------------

const onboardingResult = z.enum(['completed', 'already_complete']);
export type OnboardingResult = z.infer<typeof onboardingResult>;

/** Records the onboarding answers and consents for the signed-in user (complete_onboarding()). */
export async function completeOnboarding(
  supabase: SupabaseServerClient,
  answers: {
    country: string;
    locale: Locale;
    hasProject: boolean;
    crossborder: boolean;
  },
): Promise<OnboardingResult> {
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
 * Right after sign-in: if this browser answered the first signup step before the account existed,
 * record the answers now and forget them. Returns where the user should go next.
 */
export async function finishSignIn(
  supabase: SupabaseServerClient,
  locale: Locale,
  next: string = projectsPath(locale),
): Promise<string> {
  const cookieStore = await cookies();
  const intent = parseSignupIntent(cookieStore.get(SIGNUP_INTENT_COOKIE)?.value);
  if (intent) {
    await completeOnboarding(supabase, {
      country: intent.country,
      locale: intent.locale,
      hasProject: intent.hasProject,
      crossborder: intent.crossborder,
    });
    cookieStore.delete(SIGNUP_INTENT_COOKIE);
  }
  // Without a profile, the signed-in pages send the user to the onboarding gate.
  return next;
}
