'use client';

import { useTranslations } from 'next-intl';
import { useActionState } from 'react';
import { FormError, submitTo } from '@/components/auth/form-helpers';
import { Button } from '@/components/ui/button';
import { callAction } from '@/lib/call-action';
import type { ClaimResult } from '@/lib/launch/actions';

const IDLE: ClaimResult = { status: 'idle' };
const FAILED: ClaimResult = { status: 'error' };

/**
 * The offer of a free launch spot (D-332): what it gives, how many are left, and one button. A
 * closed window says so and offers nothing. The page already has its one gold button, so this one
 * is a quiet outline and the gold is the thin line at the start.
 */
export function LaunchSpotCard({
  open,
  spotsLeft,
  spotsTotal,
  claim,
}: {
  open: boolean;
  spotsLeft: number;
  spotsTotal: number;
  claim: () => Promise<ClaimResult>;
}) {
  const t = useTranslations('launch');
  const [state, dispatch, pending] = useActionState(() => callAction(claim, FAILED), IDLE);

  if (!open || state.status === 'closed') {
    return (
      <p role="note" className="reading border-s-[3px] border-ink bg-sunken px-4 py-3 text-small">
        {t('closed')}
      </p>
    );
  }
  if (state.status === 'granted') {
    return (
      <p
        role="status"
        className="reading border-s-[3px] border-gold-ink bg-sunken px-4 py-3 text-small"
      >
        {t('granted')}
      </p>
    );
  }

  const failure =
    state.status === 'unverified'
      ? t('unverified')
      : state.status === 'used'
        ? t('used')
        : state.status === 'error'
          ? t('error')
          : null;

  return (
    <section
      aria-labelledby="launch-heading"
      className="grid gap-3 border-s-[3px] border-gold-ink bg-sunken px-4 py-4"
    >
      <h2 id="launch-heading" className="text-h3 font-bold">
        {t('title')}
      </h2>
      <p className="reading text-small text-ink-2">{t('lead')}</p>
      <p className="text-small font-bold">
        <bdi>{t('left', { count: spotsLeft, total: spotsTotal })}</bdi>
      </p>
      {failure === null ? null : <FormError>{failure}</FormError>}
      <form noValidate onSubmit={submitTo(dispatch)} className="grid justify-items-start">
        <Button type="submit" disabled={pending}>
          {pending ? t('taking') : t('take')}
        </Button>
      </form>
    </section>
  );
}
