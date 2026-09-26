import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { AuthShell } from '@/components/auth/auth-shell';
import { SignupFlow } from '@/components/auth/signup-flow';
import { TextLink } from '@/components/ui/text-link';
import { getServerEnv } from '@/env/server';
import { currentLocale } from '@/i18n/locale';
import { redirectIfSignedIn } from '@/lib/auth/session';
import { countryOptions } from '@/lib/countries';
import { closedCountries } from '@/lib/markets';
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
  const t = await getTranslations('auth');
  const env = getServerEnv();

  return (
    <AuthShell title={t('signupTitle')} lead={t('signupLead')}>
      <SignupFlow
        countries={countryOptions(locale)}
        closed={closedCountries(env)}
        googleEnabled={env.AUTH_GOOGLE_ENABLED}
      />
      <p className="text-small">
        {t('haveAccount')} <TextLink href="/login">{t('loginTitle')}</TextLink>
      </p>
    </AuthShell>
  );
}
