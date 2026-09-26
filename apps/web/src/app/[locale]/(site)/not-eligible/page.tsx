import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { AuthShell } from '@/components/auth/auth-shell';
import { RefusalNotice } from '@/components/auth/refusal-notice';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('eligibility');
  return { title: t('refusedTitle'), robots: { index: false, follow: false } };
}

const REASONS = ['secondary', 'adult', 'closed'] as const;

/**
 * Shown after the onboarding gate deleted an account (D-059, D-065). A separate page, because
 * the deletion signs the user out and the gate itself only serves signed-in users.
 */
export default async function NotEligiblePage({
  searchParams,
}: PageProps<'/[locale]/not-eligible'>) {
  const { reason } = await searchParams;
  const kind = REASONS.find((known) => known === reason) ?? 'adult';
  const t = await getTranslations('eligibility');

  return (
    <AuthShell title={kind === 'closed' ? t('closedTitle') : t('refusedTitle')}>
      <RefusalNotice kind={kind} deleted />
    </AuthShell>
  );
}
