import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { AuthShell } from '@/components/auth/auth-shell';
import { LoginFlow } from '@/components/auth/login-flow';
import { TextLink } from '@/components/ui/text-link';
import { currentLocale } from '@/i18n/locale';
import { redirectIfSignedIn } from '@/lib/auth/session';
import { localizedAlternates } from '@/seo/alternates';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auth');
  return {
    title: t('loginTitle'),
    alternates: localizedAlternates(await currentLocale(), '/login'),
    robots: { index: false, follow: true },
  };
}

export default async function LoginPage({ searchParams }: PageProps<'/[locale]/login'>) {
  const locale = await currentLocale();
  await redirectIfSignedIn(locale);
  const t = await getTranslations('auth');
  const { error } = await searchParams;

  return (
    <AuthShell title={t('loginTitle')} lead={t('loginLead')}>
      <LoginFlow googleFailed={error === 'google'} />
      <p className="text-small">
        {t('noAccount')} <TextLink href="/signup">{t('signupTitle')}</TextLink>
      </p>
    </AuthShell>
  );
}
