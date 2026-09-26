'use client';

import { useTranslations } from 'next-intl';
import { TextLink } from '@/components/ui/text-link';
import type { Refusal } from '@/lib/auth/eligibility';
import { StepHeading } from './form-helpers';

/**
 * Shown when signup ends: under 18, no secondary school (D-059) or a closed country (D-068).
 * Says plainly what was kept: nothing, or the account created by Google has been deleted.
 */
export function RefusalNotice({ kind, deleted }: { kind: Refusal | 'closed'; deleted: boolean }) {
  const t = useTranslations('eligibility');
  const body = {
    secondary: t('refusedSecondary'),
    adult: t('refusedAdult'),
    closed: t('closedBody'),
  }[kind];

  return (
    <section className="grid gap-3 border-s-[3px] border-ink bg-sunken px-5 py-4">
      <StepHeading>{kind === 'closed' ? t('closedTitle') : t('refusedTitle')}</StepHeading>
      <p>{body}</p>
      <p className="text-small text-ink-2">{deleted ? t('accountDeleted') : t('nothingStored')}</p>
      <p>
        <TextLink href="/">{t('home')}</TextLink>
      </p>
    </section>
  );
}
