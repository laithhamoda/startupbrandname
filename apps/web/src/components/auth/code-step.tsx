'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { TextInput } from '@/components/ui/text-input';
import { type AuthFormState, verifyEmailCode } from '@/lib/auth/actions';
import { FormError, submitTo, useFocusFirstInvalid } from './form-helpers';

const IDLE: AuthFormState = { status: 'idle' };

/** Last step of sign-in and sign-up: the 6-digit code from the email. */
export function CodeStep({
  email,
  mode,
  onChangeEmail,
}: {
  email: string;
  mode: 'signup' | 'login';
  onChangeEmail: () => void;
}) {
  const locale = useLocale();
  const t = useTranslations('auth');
  const [state, dispatch, pending] = useActionState(verifyEmailCode.bind(null, locale), IDLE);
  const error = state.status === 'error' ? state.error : null;
  const form = useFocusFirstInvalid(state);

  return (
    <form ref={form} noValidate onSubmit={submitTo(dispatch)} className="grid gap-5">
      <p>
        {t.rich(mode === 'signup' ? 'codeSent' : 'codeSentLogin', {
          address: email,
          email: (chunks) => <bdi dir="ltr">{chunks}</bdi>,
        })}
      </p>
      <input type="hidden" name="email" value={email} />
      <Field
        id="code"
        label={t('code')}
        error={error === 'invalidCode' ? t('errors.invalidCode') : undefined}
      >
        {({ id, describedBy, invalid }) => (
          <TextInput
            id={id}
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            // 6 digits by design; up to 10 in case the Supabase setting ever differs.
            maxLength={10}
            dir="ltr"
            required
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
            className="num max-w-60 text-center text-h3 tracking-[0.3em]"
          />
        )}
      </Field>
      {error === 'rateLimited' || error === 'failed' ? (
        <FormError>{t(`errors.${error}`)}</FormError>
      ) : null}
      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" variant="primary" disabled={pending}>
          {t('verify')}
        </Button>
        <Button type="button" variant="quiet" onClick={onChangeEmail}>
          {t('changeEmail')}
        </Button>
      </div>
    </form>
  );
}
