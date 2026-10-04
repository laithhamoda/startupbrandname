import { describe, expect, it } from 'vitest';
import { errorCodeOf } from './errors';

// What a person reads when Supabase Auth refuses a sign-in step (auth.errors in the catalogues).
describe('errorCodeOf', () => {
  it.each([
    ['too many requests', { status: 429, code: undefined }, 'rateLimited'],
    // One code per address per minute (D-084), whatever the status says.
    [
      'the per-address email limit',
      { status: 400, code: 'over_email_send_rate_limit' },
      'rateLimited',
    ],
    // A wrong code and an expired one share this code ("Token has expired or is invalid").
    ['an expired or wrong code', { status: 403, code: 'otp_expired' }, 'invalidCode'],
    ['an address Supabase refuses', { status: 400, code: 'email_address_invalid' }, 'invalidEmail'],
    ['a request that fails validation', { status: 422, code: 'validation_failed' }, 'invalidEmail'],
    // Sign-in for an unknown address: the login form answers "sent" anyway (no enumeration).
    ['sign-ups not allowed', { status: 422, code: 'otp_disabled' }, 'failed'],
    ['an unreachable server', { status: 0, code: undefined }, 'failed'],
    ['an error without status or code', { status: undefined, code: undefined }, 'failed'],
  ] as const)('maps %s to %s', (_case, error, expected) => {
    expect(errorCodeOf(error)).toBe(expected);
  });
});
