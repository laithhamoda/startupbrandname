import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { AuthShell } from '@/components/auth/auth-shell';
import { SaveFlow } from '@/components/auth/save-flow';
import { ClientMessages } from '@/components/client-messages';
import { currentLocale } from '@/i18n/locale';
import { googleSignInAvailable } from '@/lib/auth/google';
import { projectsPath } from '@/lib/auth/next-path';
import { getSessionUser } from '@/lib/auth/session';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { localizedAlternates } from '@/seo/alternates';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auth');
  return {
    title: t('saveTitle'),
    alternates: localizedAlternates(await currentLocale(), '/save'),
    robots: { index: false, follow: true },
  };
}

/**
 * Turns a visit begun without an account into an account, keeping the answers (D-354). Only a
 * visitor has anything to save here: nobody signed in goes to start, an account to its projects.
 */
export default async function SavePage() {
  const locale = await currentLocale();
  const user = await getSessionUser(await createSupabaseServerClient());
  if (!user) redirect(`/${locale}/start`);
  if (!user.isAnonymous) redirect(projectsPath(locale));
  const t = await getTranslations('auth');

  return (
    <AuthShell title={t('saveTitle')} lead={t('saveLead')}>
      <ClientMessages namespaces={['auth']}>
        <SaveFlow googleEnabled={await googleSignInAvailable()} />
      </ClientMessages>
    </AuthShell>
  );
}
