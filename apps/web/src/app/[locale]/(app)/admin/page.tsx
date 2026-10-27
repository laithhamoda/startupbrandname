import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { currentLocale } from '@/i18n/locale';
import { requireAdmin } from '@/lib/admin/guard';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('admin');
  return { title: t('title'), robots: { index: false, follow: false } };
}

/**
 * The admin area (M7 step 8, D-327). Only an admin whose session passed the TOTP step gets here;
 * everyone else gets a 404 or the code page. The tools themselves come in the next step.
 */
export default async function AdminPage() {
  await requireAdmin(await currentLocale());
  const t = await getTranslations('admin');

  return (
    <div className="mx-auto grid max-w-[75rem] gap-4 px-4 py-12 sm:px-6">
      <h1 className="text-h1 font-extrabold">{t('title')}</h1>
      <p className="reading">{t('ready')}</p>
    </div>
  );
}
