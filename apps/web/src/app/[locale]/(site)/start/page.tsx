import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { AuthShell } from '@/components/auth/auth-shell';
import { ClientMessages } from '@/components/client-messages';
import { StartForm } from '@/components/start/start-form';
import { currentLocale } from '@/i18n/locale';
import { getSessionUser } from '@/lib/auth/session';
import { countryOptions } from '@/lib/countries';
import { currencyOptions } from '@/lib/diagnostic/currencies';
import { projectPath } from '@/lib/diagnostic/steps';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { localizedAlternates } from '@/seo/alternates';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('start');
  return {
    title: t('title'),
    alternates: localizedAlternates(await currentLocale(), '/start'),
    // The way in for a visitor, not a page to find in a search (the home page is).
    robots: { index: false, follow: true },
  };
}

/** The first visit without signup (D-350): the form, or the way back to the visit already begun. */
export default async function StartPage() {
  const locale = await currentLocale();
  const supabase = await createSupabaseServerClient();
  const user = await getSessionUser(supabase);
  if (user && !user.isAnonymous) redirect(`/${locale}/projects`);
  if (user) {
    // An anonymous visitor who already began goes back to their project.
    const { data } = await supabase
      .from('projects')
      .select('id')
      .order('created_at', { ascending: false })
      .limit(1);
    const first = data?.[0];
    if (first) redirect(`/${locale}${projectPath(first.id)}`);
  }
  const t = await getTranslations('start');

  return (
    <AuthShell title={t('title')} lead={t('lead')}>
      <ClientMessages namespaces={['start', 'projects', 'aboutYou', 'auth.errors']}>
        <StartForm
          locale={locale}
          countries={countryOptions(locale)}
          currencies={currencyOptions(locale)}
        />
      </ClientMessages>
    </AuthShell>
  );
}
