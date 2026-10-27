import { completeness, displayPercent } from '@sbn/question-bank';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { ButtonLink } from '@/components/ui/button';
import { LinkPending } from '@/components/ui/link-pending';
import { TextLink } from '@/components/ui/text-link';
import { PLANS } from '@/config/plans';
import { PRICING } from '@/content/pricing';
import { getMentorPackCheckout } from '@/env/server';
import { subscriptionsOf } from '@/lib/payments/account-plan';
import { nextPurchasable } from '@/lib/payments/offer';
import { bestPlan, projectPlan } from '@/lib/payments/plan-of';
import { Link } from '@/i18n/navigation';
import { currentLocale } from '@/i18n/locale';
import { requireAccount } from '@/lib/auth/session';
import { countryOptions } from '@/lib/countries';
import { listProjects } from '@/lib/diagnostic/project';
import { projectPath } from '@/lib/diagnostic/steps';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('projects');
  return { title: t('title'), robots: { index: false, follow: false } };
}

/** The signed-in home: the account's projects as rows, not cards (M1 design plan). */
export default async function ProjectsPage() {
  const locale = await currentLocale();
  const { supabase } = await requireAccount(locale);
  const t = await getTranslations('projects');
  const projects = await listProjects(supabase);
  const now = new Date();
  // Each project has its own package (D-320); a course voucher covers them all (D-319).
  const subscriptions = await subscriptionsOf(supabase);
  const planOf = (projectId: string) => projectPlan(subscriptions, projectId, now);
  // One project without a package at a time; the database enforces the same rule.
  const unlimited = PLANS[bestPlan(subscriptions, now)].entitlements.projects.kind === 'unlimited';
  const freeQuota = PLANS.free.entitlements.projects;
  const freeLimit = freeQuota.kind === 'count' ? freeQuota.value : 1;
  const unpaid = projects.filter(({ project }) => planOf(project.id) === 'free').length;
  const canCreate = unlimited || unpaid < freeLimit;
  const names = PRICING[locale].planNames;
  // More mentor messages for any project, once the pack is on sale (D-322).
  const packOnSale = getMentorPackCheckout() !== null;
  const countries = countryOptions(locale);
  // Western digits in both languages (CLAUDE.md §6).
  const date = new Intl.DateTimeFormat(locale === 'ar' ? 'ar-u-nu-latn' : 'en', {
    dateStyle: 'medium',
  });

  return (
    <div className="mx-auto grid max-w-[75rem] gap-8 px-4 py-10 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid gap-2">
          <h1 className="text-h1 font-extrabold">{t('title')}</h1>
          <p className="text-small text-muted">{t('rule')}</p>
        </div>
        {canCreate ? (
          <ButtonLink href="/projects/new" variant="primary">
            {t('new')}
          </ButtonLink>
        ) : null}
      </header>

      {projects.length === 0 ? (
        <p className="reading text-body-lg text-ink-2">{t('empty')}</p>
      ) : (
        <ul className="grid border-t border-hairline">
          {projects.map(({ project, answers }) => {
            const planId = planOf(project.id);
            // The next package up for this project, if there is one to buy.
            const next = nextPurchasable(planId);
            return (
              <li
                key={project.id}
                className="grid gap-1 border-b border-hairline py-4 md:grid-cols-[minmax(0,2fr)_1fr_1fr_1fr_minmax(0,1.5fr)] md:items-baseline md:gap-6"
              >
                <Link
                  href={projectPath(project.id)}
                  className="relative justify-self-start font-display text-body font-bold text-ink underline-offset-4 hover:underline"
                >
                  {/* Typed by the founder, in any script: its own direction (UX-12). */}
                  <span dir="auto">{project.title}</span>
                  <LinkPending />
                </Link>
                <span className="text-small text-ink-2">
                  {countries.find((option) => option.value === project.countryCode)?.label}
                </span>
                <span className="text-small text-ink-2">
                  {t('completeness')}{' '}
                  <bdi className="num">{displayPercent(completeness(answers).score)}%</bdi>
                </span>
                <span className="text-small text-muted">
                  {t('updated')} {date.format(new Date(project.updatedAt))}
                </span>
                <span className="text-small">
                  <span className="text-ink-2">{t('package', { plan: names[planId] })}</span>
                  {next ? (
                    <>
                      {' · '}
                      <TextLink href={`/checkout/${next}?project=${project.id}`}>
                        {planId === 'free' ? t('buy') : t('upgrade', { plan: names[next] })}
                      </TextLink>
                    </>
                  ) : null}
                  {packOnSale ? (
                    <>
                      {' · '}
                      <TextLink href={`/checkout/mentor?project=${project.id}`}>
                        {t('mentorPack')}
                      </TextLink>
                    </>
                  ) : null}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {canCreate ? null : <p className="reading text-small text-muted">{t('limit')}</p>}
    </div>
  );
}
