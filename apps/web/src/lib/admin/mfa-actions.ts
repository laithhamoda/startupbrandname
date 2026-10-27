'use server';

import { redirect, unstable_rethrow } from 'next/navigation';
import { z } from 'zod';
import { routing } from '@/i18n/routing';
import { requireAccount } from '@/lib/auth/session';
import { errorFields, log } from '@/lib/log';
import { adminStatusOf } from './guard';

const localeSchema = z.enum(routing.locales);
const factorSchema = z.uuid();
const codeSchema = z
  .string()
  .transform((value) => value.replace(/\s/g, ''))
  .pipe(z.string().regex(/^\d{6}$/));

/** The setup step: a QR code and the secret to type by hand, for the factor just created. */
export type EnrollState =
  | { readonly status: 'idle' }
  | {
      readonly status: 'ready';
      readonly factorId: string;
      readonly qr: string;
      readonly secret: string;
    }
  /** The account already has a verified factor; a second one needs the first (D-327). */
  | { readonly status: 'enrolled' }
  | { readonly status: 'error' };

export type VerifyState =
  { readonly status: 'idle' } | { readonly status: 'invalid' } | { readonly status: 'error' };

/**
 * Creates the TOTP factor of an admin who has none. A session that has not passed the second step
 * must never add a factor next to an existing one: whoever held only the email code could then
 * choose their own authenticator and become an admin. Unverified leftovers of an abandoned setup
 * are removed first.
 */
export async function startEnrollment(localeInput: string): Promise<EnrollState> {
  const locale = localeSchema.parse(localeInput);
  try {
    const { supabase } = await requireAccount(locale);
    if ((await adminStatusOf(supabase)) !== 'needs_mfa') return { status: 'error' };

    const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
    if (listError) {
      await log.error('admin.mfa_failed', { stage: 'list', code: listError.code });
      return { status: 'error' };
    }
    if (factors.totp.length > 0) return { status: 'enrolled' };
    for (const factor of factors.all) {
      if (factor.factor_type === 'totp') await supabase.auth.mfa.unenroll({ factorId: factor.id });
    }

    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: 'authenticator',
    });
    if (error) {
      await log.error('admin.mfa_failed', { stage: 'enroll', code: error.code });
      return { status: 'error' };
    }
    return {
      status: 'ready',
      factorId: data.id,
      qr: `data:image/svg+xml;utf-8,${encodeURIComponent(data.totp.qr_code)}`,
      secret: data.totp.secret,
    };
  } catch (error) {
    unstable_rethrow(error);
    await log.error('admin.mfa_failed', { ...errorFields(error), stage: 'enroll' });
    return { status: 'error' };
  }
}

/**
 * Checks the six-digit code of the factor. On success the session becomes aal2, the entry is
 * written to the audit log and the admin lands on the admin area. Supabase limits wrong guesses.
 */
export async function verifyAdminCode(
  localeInput: string,
  factorInput: string,
  _previous: VerifyState,
  formData: FormData,
): Promise<VerifyState> {
  const locale = localeSchema.parse(localeInput);
  const factorId = factorSchema.safeParse(factorInput);
  const code = codeSchema.safeParse(formData.get('code'));
  if (!factorId.success || !code.success) return { status: 'invalid' };

  try {
    const { supabase } = await requireAccount(locale);
    if ((await adminStatusOf(supabase)) !== 'needs_mfa') return { status: 'error' };

    const { error } = await supabase.auth.mfa.challengeAndVerify({
      factorId: factorId.data,
      code: code.data,
    });
    if (error) {
      // A wrong code is the usual reason; anything else is an outage, and the log says which.
      await log.warn('admin.mfa_rejected', { code: error.code });
      return { status: error.code === 'mfa_verification_failed' ? 'invalid' : 'error' };
    }
    const { error: auditError } = await supabase.rpc('admin_enter');
    if (auditError) {
      await log.error('admin.mfa_failed', { stage: 'audit', code: auditError.code });
      return { status: 'error' };
    }
  } catch (error) {
    unstable_rethrow(error);
    await log.error('admin.mfa_failed', { ...errorFields(error), stage: 'verify' });
    return { status: 'error' };
  }
  redirect(`/${locale}/admin`);
}
