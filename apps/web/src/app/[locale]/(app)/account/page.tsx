import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { DeleteAccount } from '@/components/account/delete-account';
import { PreferencesForm } from '@/components/account/preferences-form';
import { Button } from '@/components/ui/button';
import { currentLocale } from '@/i18n/locale';
import { deleteAccount, setCrossborderConsent, signOut } from '@/lib/auth/actions';
import { requireAccount } from '@/lib/auth/session';
import { countryOptions } from '@/lib/countries';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('account');
  return { title: t('title'), robots: { index: false, follow: false } };
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-4 border-t border-hairline py-8">
      <h2 className="text-h3 font-bold">{title}</h2>
      {children}
    </section>
  );
}

export default async function AccountPage() {
  const locale = await currentLocale();
  const { supabase, user, profile } = await requireAccount(locale);
  const t = await getTranslations('account');

  const { data: crossborder, error } = await supabase.rpc('has_crossborder_consent');
  if (error) throw error;

  return (
    <div className="mx-auto grid max-w-[75rem] gap-2 px-4 py-12 sm:px-6">
      <header className="grid gap-2 pb-4">
        <h1 className="text-h1 font-extrabold">{t('title')}</h1>
        {user.email ? (
          <p className="text-ink-2">
            {t.rich('signedInAs', {
              address: user.email,
              email: (chunks) => <bdi dir="ltr">{chunks}</bdi>,
            })}
          </p>
        ) : null}
      </header>

      <Section title={t('preferences')}>
        <PreferencesForm
          countries={countryOptions(locale)}
          country={profile.country_code}
          language={profile.locale}
        />
      </Section>

      <Section title={t('crossborderTitle')}>
        <p className="reading">{crossborder ? t('crossborderOn') : t('crossborderOff')}</p>
        <form action={setCrossborderConsent.bind(null, locale, !crossborder)}>
          <Button type="submit">
            {crossborder ? t('crossborderWithdraw') : t('crossborderGive')}
          </Button>
        </form>
      </Section>

      <Section title={t('session')}>
        <form action={signOut.bind(null, locale)}>
          <Button type="submit">{t('signOut')}</Button>
        </form>
      </Section>

      <Section title={t('deleteTitle')}>
        <p className="reading">{t('deleteBody')}</p>
        <div>
          <DeleteAccount action={deleteAccount.bind(null, locale)} />
        </div>
      </Section>
    </div>
  );
}
