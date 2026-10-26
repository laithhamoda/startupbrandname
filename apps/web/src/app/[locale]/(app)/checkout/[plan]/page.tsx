import { questionsFor } from '@sbn/question-bank';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { ClientMessages } from '@/components/client-messages';
import { CheckoutForm } from '@/components/payments/checkout-form';
import { ButtonLink } from '@/components/ui/button';
import { Money } from '@/components/ui/money';
import { TextLink } from '@/components/ui/text-link';
import { PLANS } from '@/config/plans';
import { PRICING } from '@/content/pricing';
import { getCheckoutEnv } from '@/env/server';
import { Link } from '@/i18n/navigation';
import { currentLocale } from '@/i18n/locale';
import { requireAccount } from '@/lib/auth/session';
import { listProjects } from '@/lib/diagnostic/project';
import { projectPlanOf } from '@/lib/payments/account-plan';
import { beginCheckout } from '@/lib/payments/checkout-actions';
import { isPurchasable, offerFor } from '@/lib/payments/offer';
import type { SupabaseServerClient } from '@/lib/supabase/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('checkout');
  return { title: t('title'), robots: { index: false, follow: false } };
}

const projectSchema = z.uuid();

/**
 * Buying a package for one project (M7 steps 5 and 6b, D-317, D-320): without a project in the
 * address, the founder first chooses which one; then what the package includes, its price for that
 * project (the difference when it moves up, D-313), the 18+ confirmation (D-086) and Paddle's
 * overlay. Signed-in accounts only; the guard sends a visitor to sign in and back here.
 */
export default async function CheckoutPage({
  params,
  searchParams,
}: {
  params: Promise<{ plan: string }>;
  searchParams: Promise<{ project?: string | string[] }>;
}) {
  const { plan } = await params;
  if (!isPurchasable(plan)) notFound();
  const query = (await searchParams).project;
  const projectId = projectSchema.safeParse(Array.isArray(query) ? query[0] : query);
  const locale = await currentLocale();
  const { supabase } = await requireAccount(locale);
  const t = await getTranslations('checkout');
  const text = PRICING[locale];
  const projects = await listProjects(supabase);
  const project = projectId.success
    ? projects.find((item) => item.project.id === projectId.data)?.project
    : undefined;
  if (projectId.success && !project) notFound();

  const { entitlements } = PLANS[plan];
  const mentor = entitlements.mentorMessages;

  return (
    <div className="mx-auto grid max-w-[40rem] gap-6 px-4 py-12 sm:px-6">
      <header className="grid gap-2">
        <p className="text-caption text-muted">{t('eyebrow')}</p>
        <h1 className="text-h1 font-extrabold">{text.planNames[plan]}</h1>
        {project ? (
          <p className="text-body text-ink-2">
            {t('forProject')}{' '}
            {/* Typed by the founder, in any script: its own direction (UX-12). */}
            <bdi dir="auto">{project.title}</bdi>
          </p>
        ) : null}
      </header>

      <ul className="reading grid gap-2 border-y border-hairline py-4">
        <li>{t('includes.questions', { count: questionsFor(entitlements.questions).length })}</li>
        <li>{text.reportLevels[entitlements.report]}</li>
        {mentor.kind === 'perProject' ? (
          <li>{t('includes.mentor', { count: mentor.value })}</li>
        ) : null}
        <li>{t('includes.projects')}</li>
        <li>{t('includes.once')}</li>
      </ul>

      {project ? (
        <ProjectOffer supabase={supabase} locale={locale} plan={plan} projectId={project.id} />
      ) : projects.length === 0 ? (
        <div className="grid justify-items-start gap-4">
          <p className="reading">{t('noProjects')}</p>
          <ButtonLink href="/projects/new" variant="primary">
            {t('newProject')}
          </ButtonLink>
        </div>
      ) : (
        <nav aria-labelledby="checkout-choose" className="grid gap-3">
          <p id="checkout-choose" className="reading">
            {t('choose')}
          </p>
          <ul className="grid border-t border-hairline">
            {projects.map(({ project: item }) => (
              <li key={item.id} className="border-b border-hairline py-3">
                <Link
                  href={`/checkout/${plan}?project=${item.id}`}
                  className="font-display font-bold text-ink underline-offset-4 hover:underline"
                >
                  <span dir="auto">{item.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}

      <p className="text-small">
        <TextLink href="/pricing">{t('backToPricing')}</TextLink>
      </p>
    </div>
  );
}

/** The price of the package for this project, or why there is nothing to buy. */
async function ProjectOffer({
  supabase,
  locale,
  plan,
  projectId,
}: {
  supabase: SupabaseServerClient;
  locale: 'ar' | 'en';
  plan: Parameters<typeof offerFor>[1];
  projectId: string;
}) {
  const t = await getTranslations('checkout');
  const env = getCheckoutEnv();
  const offer =
    env === null ? null : offerFor(await projectPlanOf(supabase, projectId), plan, env.prices);

  if (offer === null) {
    return (
      <p role="note" className="reading border-s-[3px] border-ink bg-sunken px-4 py-3">
        {t('closed')}
      </p>
    );
  }
  if (offer.status === 'owned') {
    return (
      <div className="grid justify-items-start gap-4">
        <p className="reading">{t('owned')}</p>
        <ButtonLink href="/projects" variant="primary">
          {t('toProjects')}
        </ButtonLink>
      </div>
    );
  }
  return (
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
          begin={beginCheckout.bind(null, locale, plan, projectId)}
          successUrl={`/${locale}/checkout/done?project=${projectId}`}
        />
      </ClientMessages>
    </div>
  );
}
