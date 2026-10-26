import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { ButtonLink } from '@/components/ui/button';
import { TextLink } from '@/components/ui/text-link';
import { PRICING } from '@/content/pricing';
import { currentLocale } from '@/i18n/locale';
import { requireAccount } from '@/lib/auth/session';
import { accountPlanOf } from '@/lib/payments/account-plan';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('checkout');
  return { title: t('done.title'), robots: { index: false, follow: false } };
}

/** Seconds between two looks while the webhook has not arrived yet. */
const RECHECK_SECONDS = 5;

/**
 * Where Paddle sends the buyer after paying. Access opens only with the verified webhook (D-309),
 * which can arrive a few seconds after the buyer: until then the page says so honestly and looks
 * again on its own, without JavaScript.
 */
export default async function CheckoutDonePage() {
  const locale = await currentLocale();
  const { supabase } = await requireAccount(locale);
  const t = await getTranslations('checkout');
  const plan = await accountPlanOf(supabase);
  const paid = plan !== 'free';

  return (
    <div className="mx-auto grid max-w-[40rem] gap-6 px-4 py-12 sm:px-6">
      {paid ? null : <meta httpEquiv="refresh" content={String(RECHECK_SECONDS)} />}
      <h1 className="text-h1 font-extrabold">{paid ? t('done.title') : t('done.waitingTitle')}</h1>
      {paid ? (
        <>
          <p className="reading">{t('done.active', { plan: PRICING[locale].planNames[plan] })}</p>
          <ButtonLink href="/projects" variant="primary" className="justify-self-start">
            {t('toProjects')}
          </ButtonLink>
        </>
      ) : (
        <>
          <p role="status" className="reading">
            {t('done.waiting')}
          </p>
          <p className="text-small text-muted">
            {t('done.receipt')} <TextLink href="/projects">{t('toProjects')}</TextLink>
          </p>
        </>
      )}
    </div>
  );
}
