import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { LegalShell } from '@/components/legal-shell';
import { currentLocale } from '@/i18n/locale';
import { localizedAlternates } from '@/seo/alternates';
import { PRIVACY_UPDATED, PrivacyAr, PrivacyEn } from './content';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('footer');
  return {
    title: t('privacy'),
    alternates: localizedAlternates(await currentLocale(), '/privacy'),
    // Drafts stay out of search results until the reviewed text replaces them.
    robots: { index: false, follow: true },
  };
}

export default async function PrivacyPage() {
  const locale = await currentLocale();
  const t = await getTranslations('footer');
  return (
    <LegalShell title={t('privacy')} updated={PRIVACY_UPDATED}>
      {locale === 'ar' ? <PrivacyAr /> : <PrivacyEn />}
    </LegalShell>
  );
}
