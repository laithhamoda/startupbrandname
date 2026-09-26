import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { currentLocale } from '@/i18n/locale';
import { localizedAlternates } from '@/seo/alternates';

export async function generateMetadata(): Promise<Metadata> {
  return { alternates: localizedAlternates(await currentLocale(), '') };
}

// Holding page until the public site is built in milestone M2b (docs/DECISIONS.md D-054).
export default async function HomePage() {
  const t = await getTranslations('home');

  return (
    <div className="mx-auto grid max-w-[75rem] gap-6 px-4 py-16 sm:px-6 sm:py-24">
      <h1 className="text-display font-extrabold">{t('heading')}</h1>
      <p className="reading text-body-lg text-ink-2">{t('lead')}</p>
    </div>
  );
}
