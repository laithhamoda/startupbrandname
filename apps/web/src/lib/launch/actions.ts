'use server';

import { revalidatePath } from 'next/cache';
import { unstable_rethrow } from 'next/navigation';
import { z } from 'zod';
import { routing } from '@/i18n/routing';
import { requireAccount } from '@/lib/auth/session';
import { errorFields, log } from '@/lib/log';

/** What the launch card shows after a try. */
export type ClaimResult =
  | { readonly status: 'idle' }
  /** The account took a spot, already held one, or is an admin (admins take none). */
  | { readonly status: 'granted' }
  /** No spot is left, or the end date passed. */
  | { readonly status: 'closed' }
  /** The email (or, with the phone step on, the phone) is not confirmed yet. */
  | { readonly status: 'unverified' }
  /** Another account holds a spot with this phone number. */
  | { readonly status: 'used' }
  /** The same mailbox (a +tag or Gmail-dots address of it) already holds a spot (D-338). */
  | { readonly status: 'email_used' }
  /** The email is from a throwaway-mail domain (D-338). */
  | { readonly status: 'email_blocked' }
  | { readonly status: 'error' };

const localeSchema = z.enum(routing.locales);

const answerSchema = z.enum([
  'granted',
  'already',
  'admin',
  'closed',
  'email_unverified',
  'phone_unverified',
  'phone_used',
  'email_used',
  'email_blocked',
]);

/**
 * Takes a launch spot for the signed-in account (D-332, D-334). The database decides: the window,
 * the count, the confirmed email or phone, and one spot per account.
 */
export async function claimLaunchSpot(localeInput: string): Promise<ClaimResult> {
  const locale = localeSchema.parse(localeInput);
  try {
    const { supabase } = await requireAccount(locale);
    const { data, error } = await supabase.rpc('claim_launch_spot');
    if (error) {
      await log.error('launch.claim_failed', { code: error.code });
      return { status: 'error' };
    }
    const answer = answerSchema.safeParse(data);
    if (!answer.success) {
      await log.error('launch.claim_failed', { code: 'answer' });
      return { status: 'error' };
    }
    revalidatePath(`/${locale}`, 'layout');
    switch (answer.data) {
      case 'granted':
      case 'already':
      case 'admin':
        return { status: 'granted' };
      case 'closed':
        return { status: 'closed' };
      case 'phone_used':
        return { status: 'used' };
      case 'email_used':
        return { status: 'email_used' };
      case 'email_blocked':
        return { status: 'email_blocked' };
      case 'email_unverified':
      case 'phone_unverified':
        return { status: 'unverified' };
    }
  } catch (error) {
    unstable_rethrow(error);
    await log.error('launch.claim_failed', errorFields(error));
    return { status: 'error' };
  }
}
