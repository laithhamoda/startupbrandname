import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { notFound, redirect } from 'next/navigation';
import { EnrollAuthenticator, VerifyCode } from '@/components/admin/mfa-form';
import { currentLocale } from '@/i18n/locale';
import { adminStatusOf } from '@/lib/admin/guard';
import { startEnrollment, verifyAdminCode } from '@/lib/admin/mfa-actions';
import { requireAccount } from '@/lib/auth/session';
import { log } from '@/lib/log';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('admin.mfa');
  return { title: t('title'), robots: { index: false, follow: false } };
}

/**
 * The second step for an admin (D-327): the first time, set up an authenticator app; afterwards,
 * type its current code. A visitor who is not an admin gets the same 404 as any missing page.
 */
export default async function AdminMfaPage() {
  const locale = await currentLocale();
  const { supabase } = await requireAccount(locale);
  const status = await adminStatusOf(supabase);
  if (status === 'none') notFound();
  if (status === 'admin') redirect(`/${locale}/admin`);

  const { data: factors, error } = await supabase.auth.mfa.listFactors();
  if (error) {
    await log.error('admin.mfa_failed', { stage: 'page', code: error.code });
    throw new Error('The authenticator factors could not be read.');
  }
  const verified = factors.totp[0];
  const t = await getTranslations('admin.mfa');

  return (
    <div className="mx-auto grid max-w-[75rem] gap-6 px-4 py-12 sm:px-6">
      <h1 className="text-h1 font-extrabold">{t('title')}</h1>
      {verified ? (
        <VerifyCode factorId={verified.id} action={verifyAdminCode.bind(null, locale)} />
      ) : (
        <EnrollAuthenticator
          start={startEnrollment.bind(null, locale)}
          verify={verifyAdminCode.bind(null, locale)}
        />
      )}
    </div>
  );
}
