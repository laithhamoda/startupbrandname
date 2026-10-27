import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { ClientMessages } from '@/components/client-messages';
import { CheckoutForm } from '@/components/payments/checkout-form';
import { ButtonLink } from '@/components/ui/button';
import { Money } from '@/components/ui/money';
import { TextLink } from '@/components/ui/text-link';
import { MENTOR_PACK } from '@/config/plans';
import { getMentorPackCheckout } from '@/env/server';
import { Link } from '@/i18n/navigation';
import { currentLocale } from '@/i18n/locale';
import { requireAccount } from '@/lib/auth/session';
import { listProjects } from '@/lib/diagnostic/project';
import { projectPath } from '@/lib/diagnostic/steps';
import { beginMentorPackCheckout } from '@/lib/payments/checkout-actions';
import { mentorCreditsOf } from '@/lib/payments/mentor-credits';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('checkout.pack');
  return { title: t('title'), robots: { index: false, follow: false } };
}

const projectSchema = z.uuid();

/**
 * Buying the mentor pack for one project (M7 step 6d, D-322): more AI mentor messages, on any
 * project of the founder, free ones included. Without a project in the address, the founder first
 * chooses which one. The pack is on sale only while MENTOR_PACK_ENABLED is set; until then the page
 * says payment is not open.
 */
export default async function MentorPackPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string | string[] }>;
}) {
  const query = (await searchParams).project;
  const projectId = projectSchema.safeParse(Array.isArray(query) ? query[0] : query);
  const locale = await currentLocale();
  const { supabase } = await requireAccount(locale);
  const t = await getTranslations('checkout');
  const projects = await listProjects(supabase);
  const project = projectId.success
    ? projects.find((item) => item.project.id === projectId.data)?.project
    : undefined;
  if (projectId.success && !project) notFound();
  const env = getMentorPackCheckout();

  return (
    <div className="mx-auto grid max-w-[40rem] gap-6 px-4 py-12 sm:px-6">
      <header className="grid gap-2">
        <h1 className="text-h1 font-extrabold">{t('pack.title')}</h1>
        {project ? (
          <p className="text-body text-ink-2">
            {t('forProject')}{' '}
            {/* Typed by the founder, in any script: its own direction (UX-12). */}
            <bdi dir="auto">{project.title}</bdi>
          </p>
        ) : null}
      </header>

      <ul className="reading grid gap-2 border-y border-hairline py-4">
        <li>{t('pack.messages', { count: MENTOR_PACK.messages })}</li>
        <li>{t('pack.project')}</li>
        <li>{t('includes.once')}</li>
      </ul>

      {env === null ? (
        <p role="note" className="reading border-s-[3px] border-ink bg-sunken px-4 py-3">
          {t('closed')}
        </p>
      ) : project ? (
        <div className="grid gap-4">
          <Credits count={await mentorCreditsOf(supabase, project.id)} />
          <p className="grid gap-1">
            <span className="font-display text-h2 font-extrabold">
              <Money value={String(MENTOR_PACK.priceUsd)} currency="USD" />
            </span>
            <span className="text-small text-muted">{t('onceNote')}</span>
          </p>
          <ClientMessages namespaces={['checkout']}>
            <CheckoutForm
              locale={locale}
              begin={beginMentorPackCheckout.bind(null, locale, project.id)}
              successUrl={`/${locale}/checkout/mentor/done?project=${project.id}&ref={ref}`}
            />
          </ClientMessages>
        </div>
      ) : projects.length === 0 ? (
        <div className="grid justify-items-start gap-4">
          <p className="reading">{t('noProjects')}</p>
          <ButtonLink href="/projects/new" variant="primary">
            {t('newProject')}
          </ButtonLink>
        </div>
      ) : (
        <nav aria-labelledby="pack-choose" className="grid gap-3">
          <p id="pack-choose" className="reading">
            {t('pack.choose')}
          </p>
          <ul className="grid border-t border-hairline">
            {projects.map(({ project: item }) => (
              <li key={item.id} className="border-b border-hairline py-3">
                <Link
                  href={`/checkout/mentor?project=${item.id}`}
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
        {project ? (
          <TextLink href={projectPath(project.id)}>{t('pack.backToProject')}</TextLink>
        ) : (
          <TextLink href="/projects">{t('toProjects')}</TextLink>
        )}
      </p>
    </div>
  );
}

/** The extra messages already bought for the project, when there are any. */
async function Credits({ count }: { count: number }) {
  if (count === 0) return null;
  const t = await getTranslations('checkout.pack');
  return (
    <p className="text-small text-ink-2">
      {t.rich('credits', { count: () => <bdi className="num">{count}</bdi> })}
    </p>
  );
}
