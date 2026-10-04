'use client';

import { useTranslations } from 'next-intl';
import { useActionState } from 'react';
import { FormError, submitTo } from '@/components/auth/form-helpers';
import { Button } from '@/components/ui/button';
import type { ConsentState } from '@/lib/ai/consent';
import type { AccountFormState } from '@/lib/auth/actions';
import { callAction } from '@/lib/call-action';

const IDLE: AccountFormState = { status: 'idle' };
const FAILED: AccountFormState = { status: 'error' };

const LABELS = {
  current: 'crossborderWithdraw',
  outdated: 'crossborderRenew',
  none: 'crossborderGive',
} as const satisfies Record<ConsentState, string>;

/**
 * Withdraws a current cross-border consent, renews one given to an earlier text, or gives it
 * (`action` does that; D-147). The page re-renders with the new state; a failure leaves the
 * consent as it was and says so.
 */
export function CrossborderConsent({
  consent,
  action,
}: {
  consent: ConsentState;
  action: () => Promise<AccountFormState>;
}) {
  const t = useTranslations('account');
  const errors = useTranslations('auth.errors');
  const [state, dispatch, pending] = useActionState(() => callAction(action, FAILED), IDLE);

  return (
    <form noValidate onSubmit={submitTo(dispatch)} className="grid justify-items-start gap-3">
      {state.status === 'error' ? <FormError>{errors('failed')}</FormError> : null}
      <Button type="submit" disabled={pending}>
        {pending ? t('saving') : t(LABELS[consent])}
      </Button>
    </form>
  );
}
