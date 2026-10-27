'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { unstable_rethrow } from 'next/navigation';
import { z } from 'zod';
import { getPaymentsEnv } from '@/env/server';
import { routing } from '@/i18n/routing';
import { requireAccount } from '@/lib/auth/session';
import { errorFields, log } from '@/lib/log';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import {
  clientAddress,
  networkHash,
  outcomeOf,
  voucherCodeSchema,
  type VoucherOutcome,
} from './voucher';

const localeSchema = z.enum(routing.locales);

export type VoucherFormState = { readonly status: 'idle' } | { readonly status: VoucherOutcome };

/**
 * Activates a VIVA code for the signed-in account (M7 step 6, D-325). The database cleans the
 * input, counts failures per account and per network, and writes the access; the server only
 * names the account and a keyed hash of the network, with the secret key, because a visitor's own
 * session must not choose either (the lock would then mean nothing). Access changes only here.
 */
export async function activateVoucher(
  localeInput: string,
  _previous: VoucherFormState,
  formData: FormData,
): Promise<VoucherFormState> {
  const locale = localeSchema.parse(localeInput);
  if (formData.get('adult') !== 'on') return { status: 'adult_required' };
  const code = voucherCodeSchema.safeParse(formData.get('code'));
  const env = getPaymentsEnv();
  if (env === null) return { status: 'error' };
  // A missing field is a wrong code, so the lock counts it like any other.
  const raw = code.success ? code.data : '';

  try {
    const { user } = await requireAccount(locale);
    const db = createSupabaseAdminClient(env.supabaseSecretKey);
    const { data, error } = await db.rpc('activate_voucher', {
      p_user: user.id,
      p_ip_hash: networkHash(clientAddress(await headers()), env.supabaseSecretKey),
      p_code: raw,
      p_adult_confirmed: true,
    });
    if (error) {
      await log.error('vouchers.activate_failed', { code: error.code });
      return { status: 'error' };
    }
    const outcome = outcomeOf(data);
    // A security event (M9): the outcome only, never the code or the person.
    await log.info('vouchers.activation', { reason: outcome });
    if (outcome === 'activated') revalidatePath(`/${locale}`, 'layout');
    return { status: outcome };
  } catch (error) {
    unstable_rethrow(error);
    await log.error('vouchers.activate_failed', errorFields(error));
    return { status: 'error' };
  }
}
