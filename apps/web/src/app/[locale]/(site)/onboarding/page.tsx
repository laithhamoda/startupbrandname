import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { AuthShell } from '@/components/auth/auth-shell';
import { OnboardingForm } from '@/components/auth/onboarding-form';
import { Button } from '@/components/ui/button';
import { currentLocale } from '@/i18n/locale';
import { signOut } from '@/lib/auth/actions';
import { projectsPath } from '@/lib/auth/next-path';
import { getProfile, getSessionUser } from '@/lib/auth/session';
import { countryOptions } from '@/lib/countries';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('onboarding');
  return { title: t('title'), robots: { index: false, follow: false } };
}

/** The gate for accounts that have not completed onboarding (D-065). Deleted after 24 hours. */
export default async function OnboardingPage() {
  const locale = await currentLocale();
  const supabase = await createSupabaseServerClient();
  if (!(await getSessionUser(supabase))) redirect(`/${locale}/login`);
  if (await getProfile(supabase)) redirect(projectsPath(locale));
  const t = await getTranslations('onboarding');

  return (
    <AuthShell title={t('title')} lead={t('lead')}>
      <OnboardingForm countries={countryOptions(locale)} />
      <form action={signOut.bind(null, locale)}>
        <Button type="submit" variant="quiet">
          {t('signOut')}
        </Button>
      </form>
    </AuthShell>
  );
}
