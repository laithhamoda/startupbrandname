import 'server-only';
import { createHmac } from 'node:crypto';
import { headers } from 'next/headers';
import { unstable_rethrow } from 'next/navigation';
import { getRateLimitEnv } from '@/env/server';
import { errorFields, log } from '@/lib/log';
import { clientAddress } from '@/lib/payments/voucher';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

/**
 * What is being limited: sign-in code requests, code checks, launch spot claims (D-340), and first
 * visits without signup (D-350).
 */
export type AuthAttemptKind = 'code' | 'verify' | 'claim' | 'start';

/**
 * A keyed hash of the mailbox or the account. The database keeps only this, and the key (the
 * server's secret) stops anyone rebuilding it from a list of addresses.
 */
export function subjectHash(subject: string, key: string): string {
  return createHmac('sha256', key)
    .update(`auth-subject:${subject.trim().toLowerCase()}`)
    .digest('hex');
}

/** A keyed hash of the visitor's network address, apart from the voucher one. */
export function addressHash(address: string, key: string): string {
  return createHmac('sha256', key).update(`auth-network:${address}`).digest('hex');
}

/**
 * Asks the database whether this visitor may make one more attempt (D-340): true to go on, false
 * to stop before Supabase is called. Supabase counts per address and sees Vercel's, so its own
 * limit is shared by everyone; this one counts the real network and the mailbox.
 *
 * It fails open, on purpose: with no secret key (a developer machine, the end-to-end run) or when
 * the database does not answer, sign-in must keep working, so the failure is logged and the
 * attempt goes on. Supabase's own limits still apply behind it.
 */
export async function allowAuthAttempt(kind: AuthAttemptKind, subject: string): Promise<boolean> {
  const env = getRateLimitEnv();
  if (env === null) return true;
  try {
    const key = env.supabaseSecretKey;
    const db = createSupabaseAdminClient(key);
    const { data, error } = await db.rpc('check_auth_attempt', {
      p_kind: kind,
      p_ip_hash: addressHash(clientAddress(await headers()), key),
      p_subject_hash: subjectHash(subject, key),
    });
    if (error) {
      await log.error('auth.limit_check_failed', { code: error.code });
      return true;
    }
    if (!data) {
      await log.warn('auth.rate_limited', { stage: kind, reason: 'app_limit' });
      return false;
    }
    return true;
  } catch (error) {
    unstable_rethrow(error);
    await log.error('auth.limit_check_failed', errorFields(error));
    return true;
  }
}
