import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { ButtonLink } from '@/components/ui/button';
import { TextLink } from '@/components/ui/text-link';
import { MENTOR_PACK } from '@/config/plans';
import { currentLocale } from '@/i18n/locale';
import { requireAccount } from '@/lib/auth/session';
import { projectPath } from '@/lib/diagnostic/steps';
import { packArrived } from '@/lib/payments/mentor-credits';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('checkout.pack.done');
  return { title: t('title'), robots: { index: false, follow: false } };
}

/** Seconds between two looks while the webhook has not arrived yet. */
const RECHECK_SECONDS = 5;

const idSchema = z.uuid();

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Where Paddle sends the buyer of a mentor pack (D-322). The messages are added only with the
 * verified webhook (D-309), which can arrive a few seconds after the buyer: until the credit of this
 * checkout is there, the page says so and looks again on its own, without JavaScript.
 */
export default async function MentorPackDonePage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string | string[]; ref?: string | string[] }>;
}) {
  const query = await searchParams;
  const projectId = idSchema.safeParse(first(query.project));
  const ref = idSchema.safeParse(first(query.ref));
  if (!projectId.success || !ref.success) notFound();
  const locale = await currentLocale();
  const { supabase } = await requireAccount(locale);
  const t = await getTranslations('checkout');
  const arrived = await packArrived(supabase, ref.data);

  return (
    <div className="mx-auto grid max-w-[40rem] gap-6 px-4 py-12 sm:px-6">
      {arrived ? null : <meta httpEquiv="refresh" content={String(RECHECK_SECONDS)} />}
      <h1 className="text-h1 font-extrabold">
        {arrived ? t('pack.done.title') : t('done.waitingTitle')}
      </h1>
      {arrived ? (
        <>
          <p className="reading">{t('pack.done.active', { count: MENTOR_PACK.messages })}</p>
          <ButtonLink
            href={projectPath(projectId.data)}
            variant="primary"
            className="justify-self-start"
          >
            {t('pack.backToProject')}
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
