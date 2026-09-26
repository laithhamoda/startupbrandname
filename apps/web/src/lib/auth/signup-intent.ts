import { z } from 'zod';
import { routing } from '@/i18n/routing';
import { COUNTRY_CODES } from '@/lib/countries';

export const SIGNUP_INTENT_COOKIE = 'sbn-signup';

/** Long enough to read the email and type the code, short enough not to linger. */
export const SIGNUP_INTENT_MAX_AGE_SECONDS = 30 * 60;

/**
 * What a person answered in the first signup step, before their account existed. No personal
 * data: the email is not in it. Read once, right after the account is created, then deleted.
 */
export const signupIntentSchema = z.object({
  country: z.enum(COUNTRY_CODES),
  locale: z.enum(routing.locales),
  hasProject: z.boolean(),
  crossborder: z.boolean(),
});

export type SignupIntent = z.infer<typeof signupIntentSchema>;

export function serializeSignupIntent(intent: SignupIntent): string {
  return JSON.stringify(signupIntentSchema.parse(intent));
}

/** Returns null for a missing, malformed or tampered value. */
export function parseSignupIntent(raw: string | undefined): SignupIntent | null {
  if (!raw) return null;
  try {
    const result = signupIntentSchema.safeParse(JSON.parse(raw));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}
