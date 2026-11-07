import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { AuthShell } from '@/components/auth/auth-shell';
import { SignupFlow } from '@/components/auth/signup-flow';
import { ClientMessages } from '@/components/client-messages';
import { TextLink } from '@/components/ui/text-link';
import { getServerEnv } from '@/env/server';
import { currentLocale } from '@/i18n/locale';
import { googleSignInAvailable } from '@/lib/auth/google';
import { getSessionUser, redirectIfSignedIn } from '@/lib/auth/session';
import { countryOptions } from '@/lib/countries';
import { closedCountries } from '@/lib/markets';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { localizedAlternates } from '@/seo/alternates';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auth');
  return {
    title: t('signupTitle'),
    alternates: localizedAlternates(await currentLocale(), '/signup'),
    robots: { index: false, follow: true },
  };
}

export default async function SignupPage() {
  const locale = await currentLocale();
  await redirectIfSignedIn(locale);
  // A visitor who began without an account saves that visit; a new account here would leave it behind (D-354).
  if ((await getSessionUser(await createSupabaseServerClient()))?.isAnonymous) {
    redirect(`/${locale}/save`);
  }
  const t = await getTranslations('auth');

  return (
    <AuthShell title={t('signupTitle')} lead={t('signupLead')}>
      <ClientMessages namespaces={['auth', 'aboutYou']}>
        <SignupFlow
          countries={countryOptions(locale)}
          closed={closedCountries(getServerEnv())}
          googleEnabled={await googleSignInAvailable()}
        />
      </ClientMessages>
      <p className="text-small">
        {t('haveAccount')} <TextLink href="/login">{t('loginTitle')}</TextLink>
      </p>
    </AuthShell>
  );
}
