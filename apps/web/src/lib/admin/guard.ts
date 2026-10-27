import 'server-only';
import { notFound, redirect } from 'next/navigation';
import { cache } from 'react';
import { z } from 'zod';
import type { Locale } from '@/i18n/routing';
import { requireAccount } from '@/lib/auth/session';
import { log } from '@/lib/log';
import type { SupabaseServerClient } from '@/lib/supabase/server';

/**
 * What the database says about the signed-in account (public.admin_status(), D-327): not an admin,
 * an admin whose session has not passed the second step, or an admin at aal2.
 */
export type AdminStatus = 'none' | 'needs_mfa' | 'admin';

const statusSchema = z.enum(['none', 'needs_mfa', 'admin']);

/** The account's admin status. A failed or unexpected answer is `none`: the area stays closed. */
export async function adminStatusOf(supabase: SupabaseServerClient): Promise<AdminStatus> {
  const { data, error } = await supabase.rpc('admin_status');
  if (error) {
    await log.error('admin.status_failed', { code: error.code });
    return 'none';
  }
  const parsed = statusSchema.safeParse(data);
  return parsed.success ? parsed.data : 'none';
}

export function adminMfaPath(locale: Locale): string {
  return `/${locale}/admin/mfa`;
}

/**
 * For every page of the admin area: a visitor who is not an admin gets the same 404 as a page that
 * does not exist; an admin whose session has not passed the TOTP step is sent to enter the code.
 * The database checks the same thing again in every admin function, so this guard is a convenience
 * and not the only wall. `cache` makes it one check per request.
 */
export const requireAdmin = cache(async (locale: Locale) => {
  const account = await requireAccount(locale);
  const status = await adminStatusOf(account.supabase);
  if (status === 'none') notFound();
  if (status === 'needs_mfa') redirect(adminMfaPath(locale));
  return account;
});
