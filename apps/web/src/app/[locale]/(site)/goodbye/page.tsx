import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { AuthShell } from '@/components/auth/auth-shell';
import { TextLink } from '@/components/ui/text-link';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('goodbye');
  return { title: t('title'), robots: { index: false, follow: false } };
}

/** Shown after an account is deleted from the account page. */
export default async function GoodbyePage() {
  const t = await getTranslations('goodbye');
  return (
    <AuthShell title={t('title')} lead={t('body')}>
      <p>
        <TextLink href="/">{t('home')}</TextLink>
      </p>
    </AuthShell>
  );
}
