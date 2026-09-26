'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useActionState, useState } from 'react';
import { Button } from '@/components/ui/button';
import { type AuthFormState, requestLoginCode, startGoogleLogin } from '@/lib/auth/actions';
import { CodeStep } from './code-step';
import { EmailField, OrDivider } from './email-fields';
import { FormError, StepHeading, submitTo } from './form-helpers';
import { GoogleButton } from './google-button';

const IDLE: AuthFormState = { status: 'idle' };

/** Sign-in: email, then the code; or Google. `googleFailed` comes back from the callback. */
export function LoginFlow({ googleFailed }: { googleFailed: boolean }) {
  const locale = useLocale();
  const t = useTranslations('auth');
  const [email, setEmail] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');

  const [emailState, requestCode, emailPending] = useActionState(
    async (previous: AuthFormState, formData: FormData) => {
      const result = await requestLoginCode(locale, previous, formData);
      if (result.status === 'sent') {
        setEmail(result.email);
        setStep('code');
      }
      return result;
    },
    IDLE,
  );
  const [googleState, continueWithGoogle, googlePending] = useActionState(
    async (): Promise<AuthFormState> => startGoogleLogin(locale),
    IDLE,
  );

  if (step === 'code') {
    return (
      <div className="grid gap-6">
        <StepHeading>{t('stepCode')}</StepHeading>
        <CodeStep
          email={email}
          mode="login"
          onChangeEmail={() => {
            setStep('email');
          }}
        />
      </div>
    );
  }

  const emailError = emailState.status === 'error' ? emailState.error : null;
  const googleError = googleState.status === 'error' ? googleState.error : null;
  const formError = [emailError, googleError].find(
    (error) => error === 'rateLimited' || error === 'failed',
  );

  return (
    <div className="grid gap-6">
      {googleFailed && googleState.status === 'idle' ? (
        <FormError>{t('errors.google')}</FormError>
      ) : null}
      <form noValidate onSubmit={submitTo(requestCode)} className="grid gap-5">
        <EmailField error={emailError} defaultValue={email} />
        {formError ? <FormError>{t(`errors.${formError}`)}</FormError> : null}
        <div>
          <Button type="submit" variant="primary" disabled={emailPending}>
            {t('sendCode')}
          </Button>
        </div>
      </form>
      <OrDivider />
      <form noValidate onSubmit={submitTo(continueWithGoogle)}>
        <GoogleButton pending={googlePending} />
      </form>
    </div>
  );
}
