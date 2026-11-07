'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useActionState, useState } from 'react';
import { Button } from '@/components/ui/button';
import { type AuthFormState, requestSaveCode, startGoogleSave } from '@/lib/auth/actions';
import { CodeStep } from './code-step';
import { EmailField, OrDivider } from './email-fields';
import { FormError, StepHeading, submitTo } from './form-helpers';
import { GoogleButton } from './google-button';

const IDLE: AuthFormState = { status: 'idle' };

/**
 * Saving a visit begun without an account (D-354): the email, then the code; or Google when it is
 * configured. The visitor's answers and project stay, because the email is added to the same
 * identity (Supabase `email_change`), not to a new one.
 */
export function SaveFlow({ googleEnabled }: { googleEnabled: boolean }) {
  const locale = useLocale();
  const t = useTranslations('auth');
  const [email, setEmail] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [cameBack, setCameBack] = useState(false);

  const [emailState, requestCode, emailPending] = useActionState(
    async (previous: AuthFormState, formData: FormData) => {
      const result = await requestSaveCode(locale, previous, formData);
      if (result.status === 'sent') {
        setEmail(result.email);
        setStep('code');
      }
      return result;
    },
    IDLE,
  );
  const [googleState, continueWithGoogle, googlePending] = useActionState(
    async (): Promise<AuthFormState> => startGoogleSave(locale),
    IDLE,
  );

  if (step === 'code') {
    return (
      <div className="grid gap-6">
        <StepHeading key="code">{t('stepCode')}</StepHeading>
        <CodeStep
          email={email}
          mode="save"
          onChangeEmail={() => {
            setCameBack(true);
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
      <StepHeading key="email" focus={cameBack}>
        {t('stepEmail')}
      </StepHeading>
      <form noValidate onSubmit={submitTo(requestCode)} className="grid gap-5">
        <EmailField error={emailError} defaultValue={email} />
        {formError ? <FormError>{t(`errors.${formError}`)}</FormError> : null}
        <div>
          <Button type="submit" variant="primary" disabled={emailPending}>
            {t('sendCode')}
          </Button>
        </div>
      </form>
      {googleEnabled ? (
        <>
          <OrDivider />
          <form noValidate onSubmit={submitTo(continueWithGoogle)}>
            <GoogleButton pending={googlePending} />
          </form>
        </>
      ) : null}
    </div>
  );
}
