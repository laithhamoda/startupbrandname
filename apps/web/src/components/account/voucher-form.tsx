'use client';

import { useTranslations } from 'next-intl';
import { useActionState } from 'react';
import { FormError, submitTo } from '@/components/auth/form-helpers';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { TextInput } from '@/components/ui/text-input';
import { callAction } from '@/lib/call-action';
import type { VoucherFormState } from '@/lib/payments/voucher-actions';

const IDLE: VoucherFormState = { status: 'idle' };
const FAILED: VoucherFormState = { status: 'error' };

/**
 * Activates a VIVA code (D-325). The 18+ box is required (D-086). The code stays typed after a
 * rejection, and the answer is announced; every wrong code gets the same message.
 */
export function VoucherForm({
  action,
}: {
  action: (previous: VoucherFormState, formData: FormData) => Promise<VoucherFormState>;
}) {
  const t = useTranslations('account.voucher');
  const [state, dispatch, pending] = useActionState(
    (previous: VoucherFormState, formData: FormData) =>
      callAction(() => action(previous, formData), FAILED),
    IDLE,
  );

  if (state.status === 'activated') {
    return (
      <p role="status" className="reading font-bold">
        {t('activated')}
      </p>
    );
  }

  return (
    <form noValidate onSubmit={submitTo(dispatch)} className="grid max-w-[28rem] gap-4">
      {state.status !== 'idle' && state.status !== 'adult_required' ? (
        <FormError>{t(`errors.${state.status}`)}</FormError>
      ) : null}
      <div className="grid gap-1.5">
        <label htmlFor="voucher-code" className="font-bold">
          {t('label')}
        </label>
        <TextInput
          id="voucher-code"
          name="code"
          dir="ltr"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={64}
          placeholder="VIVA XXXX XXXX"
          required
        />
        <p className="text-caption text-muted">{t('hint')}</p>
      </div>
      <Checkbox
        id="voucher-adult"
        name="adult"
        label={t('adult')}
        error={state.status === 'adult_required' ? t('errors.adult_required') : undefined}
      />
      <div>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? t('activating') : t('activate')}
        </Button>
      </div>
    </form>
  );
}
