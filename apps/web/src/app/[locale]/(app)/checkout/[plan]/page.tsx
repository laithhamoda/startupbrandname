import { questionsFor } from '@sbn/question-bank';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { ClientMessages } from '@/components/client-messages';
import { CheckoutForm } from '@/components/payments/checkout-form';
import { ButtonLink } from '@/components/ui/button';
import { Money } from '@/components/ui/money';
import { TextLink } from '@/components/ui/text-link';
import { PLANS } from '@/config/plans';
import { PRICING } from '@/content/pricing';
import { getCheckoutEnv } from '@/env/server';
import { currentLocale } from '@/i18n/locale';
import { requireAccount } from '@/lib/auth/session';
import { accountPlanOf } from '@/lib/payments/account-plan';
import { beginCheckout } from '@/lib/payments/checkout-actions';
import { isPurchasable, offerFor } from '@/lib/payments/offer';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('checkout');
  return { title: t('title'), robots: { index: false, follow: false } };
}

/**
 * Buying a package (M7 step 5, D-317): what it includes, its price (the difference for an upgrade,
 * D-313), the 18+ confirmation (D-086) and Paddle's overlay. Signed-in accounts only; the guard
 * sends a visitor to sign in and back here.
 */
export default async function CheckoutPage({ params }: { params: Promise<{ plan: string }> }) {
  const { plan } = await params;
  if (!isPurchasable(plan)) notFound();
  const locale = await currentLocale();
  const { supabase } = await requireAccount(locale);
  const t = await getTranslations('checkout');
  const text = PRICING[locale];
  const env = getCheckoutEnv();
  const current = await accountPlanOf(supabase);
  const offer = env === null ? null : offerFor(current, plan, env.prices);
  const { entitlements } = PLANS[plan];
  const mentor = entitlements.mentorMessages;

  return (
    <div className="mx-auto grid max-w-[40rem] gap-6 px-4 py-12 sm:px-6">
      <header className="grid gap-2">
        <p className="text-caption text-muted">{t('eyebrow')}</p>
        <h1 className="text-h1 font-extrabold">{text.planNames[plan]}</h1>
      </header>

      <ul className="reading grid gap-2 border-y border-hairline py-4">
        <li>{t('includes.questions', { count: questionsFor(entitlements.questions).length })}</li>
        <li>{text.reportLevels[entitlements.report]}</li>
        {mentor.kind === 'perProject' ? (
          <li>{t('includes.mentor', { count: mentor.value })}</li>
        ) : null}
        {entitlements.projects.kind === 'count' ? (
          <li>{t('includes.projects', { count: entitlements.projects.value })}</li>
        ) : null}
        <li>{t('includes.once')}</li>
      </ul>

      {offer === null ? (
        <p role="note" className="reading border-s-[3px] border-ink bg-sunken px-4 py-3">
          {t('closed')}
        </p>
      ) : offer.status === 'owned' ? (
        <div className="grid justify-items-start gap-4">
          <p className="reading">{t('owned')}</p>
          <ButtonLink href="/projects" variant="primary">
            {t('toProjects')}
          </ButtonLink>
        </div>
      ) : (
        <div className="grid gap-4">
          <p className="grid gap-1">
            <span className="font-display text-h2 font-extrabold">
              <Money value={String(offer.priceUsd)} currency="USD" />
            </span>
            <span className="text-small text-muted">
              {offer.upgrade ? t('upgradeNote') : t('onceNote')}
            </span>
          </p>
          <ClientMessages namespaces={['checkout']}>
            <CheckoutForm
              locale={locale}
              begin={beginCheckout.bind(null, locale, plan)}
              successUrl={`/${locale}/checkout/done`}
            />
          </ClientMessages>
        </div>
      )}

      <p className="text-small">
        <TextLink href="/pricing">{t('backToPricing')}</TextLink>
      </p>
    </div>
  );
}
