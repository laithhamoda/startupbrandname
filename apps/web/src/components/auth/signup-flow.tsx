'use client';

import { useLocale, useTranslations } from 'next-intl';
import { type SubmitEvent, useActionState, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  type AuthErrorCode,
  type AuthFormState,
  requestSignupCode,
  startGoogleSignup,
} from '@/lib/auth/actions';
import {
  type OnboardingAnswers,
  type OnboardingField,
  parseOnboarding,
} from '@/lib/auth/onboarding';
import type { CountryCode, CountryOption } from '@/lib/countries';
import { ClosedNotice } from './closed-notice';
import { CodeStep } from './code-step';
import { EmailField, OrDivider } from './email-fields';
import { FormError, StepHeading, submitTo, useFocusFirstInvalid } from './form-helpers';
import { GoogleButton } from './google-button';
import { OnboardingFields, OnboardingHiddenInputs } from './onboarding-fields';

const IDLE: AuthFormState = { status: 'idle' };

type Step = 'aboutYou' | 'email' | 'code';

const STEP_NUMBER: Record<Step, number> = { aboutYou: 1, email: 2, code: 3 };

/**
 * Signup in three steps (D-065, D-086):
 * 1. About you: country, "do you have a project or an idea?", the terms and the optional
 *    cross-border consent, checked in the browser. A closed country ends signup here.
 * 2. Email or Google. The server checks the answers again and keeps them in a short-lived
 *    cookie until the account exists.
 * 3. The emailed code. Verifying it creates the session and records the answers.
 */
export function SignupFlow({
  countries,
  closed,
  googleEnabled,
}: {
  countries: readonly CountryOption[];
  closed: readonly CountryCode[];
  /** False until Google sign-in is configured for this environment (AUTH_GOOGLE_ENABLED). */
  googleEnabled: boolean;
}) {
  const locale = useLocale();
  const t = useTranslations('auth');
  const [step, setStep] = useState<Step>('aboutYou');
  const [answers, setAnswers] = useState<OnboardingAnswers | null>(null);
  const [invalid, setInvalid] = useState<OnboardingField[]>([]);
  const [notice, setNotice] = useState<AuthErrorCode | null>(null);
  const [countryClosed, setCountryClosed] = useState(false);
  const [email, setEmail] = useState('');
  const [moved, setMoved] = useState(false);
  const aboutYouForm = useFocusFirstInvalid(invalid);

  function goTo(next: Step) {
    setMoved(true);
    setStep(next);
  }

  /** Applies a server answer to the flow and returns it for the form's own state. */
  function follow(result: AuthFormState): AuthFormState {
    if (result.status === 'sent') {
      setEmail(result.email);
      goTo('code');
    } else if (result.status === 'closed') {
      setCountryClosed(true);
    } else if (
      result.status === 'error' &&
      (result.error === 'answers' || result.error === 'signupExpired')
    ) {
      setInvalid(result.invalid ?? []);
      setNotice(result.error);
      goTo('aboutYou');
    }
    return result;
  }

  const [emailState, requestCode, emailPending] = useActionState(
    async (previous: AuthFormState, formData: FormData) =>
      follow(await requestSignupCode(locale, previous, formData)),
    IDLE,
  );
  const [googleState, continueWithGoogle, googlePending] = useActionState(
    async (previous: AuthFormState, formData: FormData) =>
      follow(await startGoogleSignup(locale, previous, formData)),
    IDLE,
  );

  function checkAnswers(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);
    const parsed = parseOnboarding(new FormData(event.currentTarget));
    if (!parsed.ok) {
      setInvalid(parsed.invalid);
      return;
    }
    setInvalid([]);
    if (closed.includes(parsed.answers.country)) {
      setCountryClosed(true);
      return;
    }
    setAnswers(parsed.answers);
    goTo('email');
  }

  if (countryClosed) return <ClosedNotice deleted={false} />;

  const title = {
    aboutYou: t('stepAboutYou'),
    email: t('stepEmail'),
    code: t('stepCode'),
  }[step];
  const emailError = emailState.status === 'error' ? emailState.error : null;
  const googleError = googleState.status === 'error' ? googleState.error : null;
  const formError = [emailError, googleError].find(
    (error) => error === 'rateLimited' || error === 'failed',
  );

  return (
    <div className="grid gap-6">
      <StepHeading key={step} focus={moved}>
        <span className="block text-small font-medium text-muted">
          {t('step', { current: STEP_NUMBER[step], total: 3 })}
        </span>
        {title}
      </StepHeading>

      {step === 'aboutYou' ? (
        <form ref={aboutYouForm} noValidate onSubmit={checkAnswers} className="grid gap-6">
          {notice ? <FormError>{t(`errors.${notice}`)}</FormError> : null}
          <OnboardingFields countries={countries} invalid={invalid} defaults={answers} />
          <div>
            <Button type="submit" variant="primary">
              {t('continue')}
            </Button>
          </div>
        </form>
      ) : null}

      {step === 'email' && answers ? (
        <div className="grid gap-6">
          <form noValidate onSubmit={submitTo(requestCode)} className="grid gap-5">
            <OnboardingHiddenInputs answers={answers} />
            <EmailField error={emailError} defaultValue={email} />
            {formError ? <FormError>{t(`errors.${formError}`)}</FormError> : null}
            <div className="flex flex-wrap items-center gap-4">
              <Button type="submit" variant="primary" disabled={emailPending}>
                {t('sendCode')}
              </Button>
              <Button
                type="button"
                variant="quiet"
                onClick={() => {
                  goTo('aboutYou');
                }}
              >
                {t('back')}
              </Button>
            </div>
          </form>
          {googleEnabled ? (
            <>
              <OrDivider />
              <form noValidate onSubmit={submitTo(continueWithGoogle)}>
                <OnboardingHiddenInputs answers={answers} />
                <GoogleButton pending={googlePending} />
              </form>
            </>
          ) : null}
        </div>
      ) : null}

      {step === 'code' ? (
        <CodeStep
          email={email}
          mode="signup"
          onChangeEmail={() => {
            goTo('email');
          }}
        />
      ) : null}
    </div>
  );
}
