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
  type EligibilityAnswers,
  type EligibilityField,
  parseEligibility,
  type Refusal,
  refusalOf,
} from '@/lib/auth/eligibility';
import type { CountryCode, CountryOption } from '@/lib/countries';
import { CodeStep } from './code-step';
import { EmailField, OrDivider } from './email-fields';
import { EligibilityFields, EligibilityHiddenInputs } from './eligibility-fields';
import { FormError, StepHeading, submitTo, useFocusFirstInvalid } from './form-helpers';
import { GoogleButton } from './google-button';
import { RefusalNotice } from './refusal-notice';

const IDLE: AuthFormState = { status: 'idle' };

type Step = 'eligibility' | 'email' | 'code';
interface Outcome {
  kind: Refusal | 'closed';
  deleted: boolean;
}

const STEP_NUMBER: Record<Step, number> = { eligibility: 1, email: 2, code: 3 };

/**
 * Signup in three steps (D-059, D-065):
 * 1. Declarations, checked in the browser: a "no" ends signup and nothing leaves the page.
 * 2. Email or Google. The server checks the declarations again and keeps them in a short-lived
 *    cookie until the account exists.
 * 3. The emailed code. Verifying it creates the session and records the declarations.
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
  const [step, setStep] = useState<Step>('eligibility');
  const [answers, setAnswers] = useState<EligibilityAnswers | null>(null);
  const [invalid, setInvalid] = useState<EligibilityField[]>([]);
  const [notice, setNotice] = useState<AuthErrorCode | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [email, setEmail] = useState('');
  const [moved, setMoved] = useState(false);
  const eligibilityForm = useFocusFirstInvalid(invalid);

  function goTo(next: Step) {
    setMoved(true);
    setStep(next);
  }

  /** Applies a server answer to the flow and returns it for the form's own state. */
  function follow(result: AuthFormState): AuthFormState {
    if (result.status === 'sent') {
      setEmail(result.email);
      goTo('code');
    } else if (result.status === 'refused') {
      setOutcome({ kind: result.refusal, deleted: result.deleted });
    } else if (result.status === 'closed') {
      setOutcome({ kind: 'closed', deleted: result.deleted });
    } else if (
      result.status === 'error' &&
      (result.error === 'eligibility' || result.error === 'signupExpired')
    ) {
      setInvalid(result.invalid ?? []);
      setNotice(result.error);
      goTo('eligibility');
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

  function checkEligibility(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);
    const parsed = parseEligibility(new FormData(event.currentTarget));
    if (!parsed.ok) {
      setInvalid(parsed.invalid);
      return;
    }
    setInvalid([]);
    const refusal = refusalOf(parsed.answers);
    if (refusal) {
      setOutcome({ kind: refusal, deleted: false });
      return;
    }
    if (closed.includes(parsed.answers.country)) {
      setOutcome({ kind: 'closed', deleted: false });
      return;
    }
    setAnswers(parsed.answers);
    goTo('email');
  }

  if (outcome) return <RefusalNotice kind={outcome.kind} deleted={outcome.deleted} />;

  const title = {
    eligibility: t('stepEligibility'),
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

      {step === 'eligibility' ? (
        <form ref={eligibilityForm} noValidate onSubmit={checkEligibility} className="grid gap-6">
          {notice ? <FormError>{t(`errors.${notice}`)}</FormError> : null}
          <EligibilityFields countries={countries} invalid={invalid} defaults={answers} />
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
            <EligibilityHiddenInputs answers={answers} />
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
                  goTo('eligibility');
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
                <EligibilityHiddenInputs answers={answers} />
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
