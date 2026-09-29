'use client';

import { useTranslations } from 'next-intl';
import { useActionState } from 'react';
import { FormError, submitTo } from '@/components/auth/form-helpers';
import { Button } from '@/components/ui/button';
import type { AccountFormState } from '@/lib/auth/actions';
import { callAction } from '@/lib/call-action';

const IDLE: AccountFormState = { status: 'idle' };
const FAILED: AccountFormState = { status: 'error' };

/**
 * Gives or withdraws the cross-border consent (`action` does the opposite of `given`). The page
 * re-renders with the new state; a failure leaves the consent as it was and says so.
 */
export function CrossborderConsent({
  given,
  action,
}: {
  given: boolean;
  action: () => Promise<AccountFormState>;
}) {
  const t = useTranslations('account');
  const errors = useTranslations('auth.errors');
  const [state, dispatch, pending] = useActionState(() => callAction(action, FAILED), IDLE);

  return (
    <form noValidate onSubmit={submitTo(dispatch)} className="grid justify-items-start gap-3">
      {state.status === 'error' ? <FormError>{errors('failed')}</FormError> : null}
      <Button type="submit" disabled={pending}>
        {pending ? t('saving') : given ? t('crossborderWithdraw') : t('crossborderGive')}
      </Button>
    </form>
  );
}
