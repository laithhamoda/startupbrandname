'use client';

import { useTranslations } from 'next-intl';
import { useActionState } from 'react';
import { FormError, submitTo } from '@/components/auth/form-helpers';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import type { AccountFormState } from '@/lib/auth/actions';
import { callAction } from '@/lib/call-action';

const IDLE: AccountFormState = { status: 'idle' };
const FAILED: AccountFormState = { status: 'error' };

/**
 * Deletion asks once more in a dialog; the action deletes the account and signs out. If it
 * fails, nothing was deleted: the dialog stays open with the error, so trying again is one click.
 */
export function DeleteAccount({ action }: { action: () => Promise<AccountFormState> }) {
  const t = useTranslations('account');
  const errors = useTranslations('auth.errors');
  const [state, dispatch, pending] = useActionState(() => callAction(action, FAILED), IDLE);

  return (
    <Dialog
      trigger={<Button className="text-danger">{t('deleteButton')}</Button>}
      title={t('deleteConfirmTitle')}
      description={t('deleteConfirmBody')}
    >
      <form noValidate onSubmit={submitTo(dispatch)} className="grid justify-items-start gap-4">
        {state.status === 'error' ? <FormError>{errors('failed')}</FormError> : null}
        <Button type="submit" disabled={pending} className="border-danger text-danger">
          {pending ? t('deleting') : t('deleteConfirm')}
        </Button>
      </form>
    </Dialog>
  );
}
