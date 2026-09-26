import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { LegalShell } from '@/components/legal-shell';
import { currentLocale } from '@/i18n/locale';
import { localizedAlternates } from '@/seo/alternates';
import { TERMS_UPDATED, TermsAr, TermsEn } from './content';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('footer');
  return {
    title: t('terms'),
    alternates: localizedAlternates(await currentLocale(), '/terms'),
    // Drafts stay out of search results until the reviewed text replaces them.
    robots: { index: false, follow: true },
  };
}

export default async function TermsPage() {
  const locale = await currentLocale();
  const t = await getTranslations('footer');
  return (
    <LegalShell title={t('terms')} updated={TERMS_UPDATED}>
      {locale === 'ar' ? <TermsAr /> : <TermsEn />}
    </LegalShell>
  );
}
