import type { AuthError } from '@supabase/supabase-js';

/** What a sign-in or sign-up form says went wrong, as a code; the forms translate it. */
export type AuthErrorCode =
  'invalidEmail' | 'invalidCode' | 'rateLimited' | 'failed' | 'signupExpired' | 'answers';

/**
 * The code shown for an error from Supabase Auth. It lives outside actions.ts: a 'use server'
 * file may export only Server Actions, and this mapping decides what people read, so it is tested
 * on its own (errors.test.ts).
 */
export function errorCodeOf(error: Pick<AuthError, 'status' | 'code'>): AuthErrorCode {
  if (error.status === 429 || error.code === 'over_email_send_rate_limit') return 'rateLimited';
  // Supabase uses otp_expired for a wrong code too ("Token has expired or is invalid").
  if (error.code === 'otp_expired') return 'invalidCode';
  if (error.code === 'validation_failed' || error.code === 'email_address_invalid') {
    return 'invalidEmail';
  }
  return 'failed';
}
