'use client';

import { useTranslations } from 'next-intl';
import { useActionState } from 'react';
import { FormError, submitTo } from '@/components/auth/form-helpers';
import { Button } from '@/components/ui/button';
import { TextInput } from '@/components/ui/text-input';
import { callAction } from '@/lib/call-action';
import type { EnrollState, VerifyState } from '@/lib/admin/mfa-actions';

const IDLE_VERIFY: VerifyState = { status: 'idle' };
const FAILED_VERIFY: VerifyState = { status: 'error' };
const IDLE_ENROLL: EnrollState = { status: 'idle' };
const FAILED_ENROLL: EnrollState = { status: 'error' };

type VerifyAction = (
  factorId: string,
  previous: VerifyState,
  formData: FormData,
) => Promise<VerifyState>;

/** The six-digit code field for one factor. The page changes when the code is accepted. */
function CodeForm({ factorId, action }: { factorId: string; action: VerifyAction }) {
  const t = useTranslations('admin.mfa');
  const [state, dispatch, pending] = useActionState(
    (previous: VerifyState, formData: FormData) =>
      callAction(() => action(factorId, previous, formData), FAILED_VERIFY),
    IDLE_VERIFY,
  );

  return (
    <form noValidate onSubmit={submitTo(dispatch)} className="grid max-w-[22rem] gap-4">
      {state.status === 'invalid' || state.status === 'error' ? (
        <FormError>{t(`errors.${state.status}`)}</FormError>
      ) : null}
      <div className="grid gap-1.5">
        <label htmlFor="admin-code" className="font-bold">
          {t('codeLabel')}
        </label>
        <TextInput
          id="admin-code"
          name="code"
          dir="ltr"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={7}
          required
          aria-invalid={state.status === 'invalid' ? true : undefined}
        />
        <p className="text-caption text-muted">{t('codeHint')}</p>
      </div>
      <div>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? t('verifying') : t('verify')}
        </Button>
      </div>
    </form>
  );
}

/** Asks an admin who already has an authenticator for the current code. */
export function VerifyCode({ factorId, action }: { factorId: string; action: VerifyAction }) {
  const t = useTranslations('admin.mfa');
  return (
    <div className="grid gap-4">
      <p className="reading">{t('introVerify')}</p>
      <CodeForm factorId={factorId} action={action} />
    </div>
  );
}

/** First sign-in of an admin: scan the QR code (or type the secret), then prove it with a code. */
export function EnrollAuthenticator({
  start,
  verify,
}: {
  start: () => Promise<EnrollState>;
  verify: VerifyAction;
}) {
  const t = useTranslations('admin.mfa');
  const [state, dispatch, pending] = useActionState(
    () => callAction(start, FAILED_ENROLL),
    IDLE_ENROLL,
  );

  if (state.status === 'ready') {
    return (
      <div className="grid gap-5">
        <p className="reading">{t('scan')}</p>
        {/* A data URL made by Supabase from the secret; it never leaves this page. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={state.qr}
          alt={t('qrAlt')}
          width={192}
          height={192}
          className="size-48 bg-white p-2"
        />
        <div className="grid gap-1">
          <span className="font-bold">{t('secretLabel')}</span>
          <bdi dir="ltr" className="select-all break-all font-mono text-small">
            {state.secret}
          </bdi>
        </div>
        <p className="reading">{t('afterScan')}</p>
        <CodeForm factorId={state.factorId} action={verify} />
      </div>
    );
  }

  return (
    <form noValidate onSubmit={submitTo(dispatch)} className="grid justify-items-start gap-4">
      <p className="reading">{t('introEnroll')}</p>
      {state.status === 'error' ? <FormError>{t('errors.error')}</FormError> : null}
      {state.status === 'enrolled' ? <FormError>{t('errors.enrolled')}</FormError> : null}
      <Button type="submit" variant="primary" disabled={pending}>
        {pending ? t('starting') : t('start')}
      </Button>
    </form>
  );
}
