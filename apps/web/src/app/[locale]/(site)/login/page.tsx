import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { AuthShell } from '@/components/auth/auth-shell';
import { LoginFlow } from '@/components/auth/login-flow';
import { TextLink } from '@/components/ui/text-link';
import { currentLocale } from '@/i18n/locale';
import { googleSignInAvailable } from '@/lib/auth/google';
import { projectsPath, safeNextPath } from '@/lib/auth/next-path';
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
  const { error, next } = await searchParams;
  // The page that sent the visitor here (requireAccount), if it is one of ours.
  const destination = safeNextPath(typeof next === 'string' ? next : null, projectsPath(locale));
  await redirectIfSignedIn(locale, destination);
  const t = await getTranslations('auth');

  return (
    <AuthShell title={t('loginTitle')} lead={t('loginLead')}>
      <LoginFlow
        googleEnabled={await googleSignInAvailable()}
        googleFailed={error === 'google'}
        next={destination}
      />
      <p className="text-small">
        {t('noAccount')} <TextLink href="/signup">{t('signupTitle')}</TextLink>
      </p>
    </AuthShell>
  );
}
