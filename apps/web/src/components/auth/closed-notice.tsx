'use client';

import { useTranslations } from 'next-intl';
import { TextLink } from '@/components/ui/text-link';
import { StepHeading } from './form-helpers';

/**
 * Shown when signup is switched off for the chosen country (D-068). Says plainly what was kept:
 * nothing, or the account created at sign-in has been deleted.
 */
export function ClosedNotice({ deleted }: { deleted: boolean }) {
  const t = useTranslations('aboutYou');

  return (
    <section className="grid gap-3 border-s-[3px] border-ink bg-sunken px-5 py-4">
      <StepHeading>{t('closedTitle')}</StepHeading>
      <p>{t('closedBody')}</p>
      <p className="text-small text-ink-2">{deleted ? t('accountDeleted') : t('nothingStored')}</p>
      <p>
        <TextLink href="/">{t('home')}</TextLink>
      </p>
    </section>
  );
}
