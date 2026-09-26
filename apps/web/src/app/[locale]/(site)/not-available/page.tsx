import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { AuthShell } from '@/components/auth/auth-shell';
import { ClosedNotice } from '@/components/auth/closed-notice';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('aboutYou');
  return { title: t('closedTitle'), robots: { index: false, follow: false } };
}

/**
 * Shown after the onboarding gate deleted an account from a country where signup is switched off
 * (D-068). A separate page, because the deletion signs the user out and the gate itself only
 * serves signed-in users.
 */
export default async function NotAvailablePage() {
  const t = await getTranslations('aboutYou');
  return (
    <AuthShell title={t('closedTitle')}>
      <ClosedNotice deleted />
    </AuthShell>
  );
}
