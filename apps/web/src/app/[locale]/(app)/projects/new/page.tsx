import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { NewProjectForm } from '@/components/diagnostic/new-project-form';
import { currentLocale } from '@/i18n/locale';
import { requireAccount } from '@/lib/auth/session';
import { countryOptions } from '@/lib/countries';
import { currencyOptions } from '@/lib/diagnostic/currencies';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('projects');
  return { title: t('newTitle'), robots: { index: false, follow: false } };
}

export default async function NewProjectPage() {
  const locale = await currentLocale();
  const { profile } = await requireAccount(locale);
  const t = await getTranslations('projects');

  return (
    <div className="mx-auto grid max-w-[40rem] gap-6 px-4 py-10 sm:px-6">
      <h1 className="text-h1 font-extrabold">{t('newTitle')}</h1>
      <p className="reading text-ink-2">{t('newLead')}</p>
      <NewProjectForm
        locale={locale}
        countries={countryOptions(locale)}
        currencies={currencyOptions(locale)}
        defaultCountry={profile.country_code}
      />
    </div>
  );
}
