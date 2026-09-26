import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { currentLocale } from '@/i18n/locale';
import { requireAccount } from '@/lib/auth/session';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('projects');
  return { title: t('title'), robots: { index: false, follow: false } };
}

// The signed-in home. Projects arrive with the diagnostic in milestone M3.
export default async function ProjectsPage() {
  await requireAccount(await currentLocale());
  const t = await getTranslations('projects');

  return (
    <div className="mx-auto grid max-w-[75rem] gap-4 px-4 py-12 sm:px-6">
      <h1 className="text-h1 font-extrabold">{t('title')}</h1>
      <p className="text-body-lg">{t('empty')}</p>
      <p className="reading text-ink-2">{t('soon')}</p>
    </div>
  );
}
