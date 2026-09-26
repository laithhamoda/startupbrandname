'use client';

import { useLocale, useTranslations } from 'next-intl';
import { type SubmitEvent, startTransition, useActionState, useState } from 'react';
import { Button } from '@/components/ui/button';
import { type AuthFormState, submitOnboarding } from '@/lib/auth/actions';
import { type EligibilityField, parseEligibility } from '@/lib/auth/eligibility';
import type { CountryOption } from '@/lib/countries';
import { EligibilityFields } from './eligibility-fields';
import { FormError, useFocusFirstInvalid } from './form-helpers';
import { RefusalNotice } from './refusal-notice';

const IDLE: AuthFormState = { status: 'idle' };

/**
 * The onboarding gate for an account that exists without declarations, typically created by
 * Google (D-065). A "no" deletes the account at once, on the server.
 */
export function OnboardingForm({ countries }: { countries: readonly CountryOption[] }) {
  const locale = useLocale();
  const t = useTranslations('onboarding');
  const errors = useTranslations('auth.errors');
  const [invalid, setInvalid] = useState<EligibilityField[]>([]);
  const [state, dispatch, pending] = useActionState(submitOnboarding.bind(null, locale), IDLE);
  const form = useFocusFirstInvalid(invalid);

  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const parsed = parseEligibility(formData);
    setInvalid(parsed.ok ? [] : parsed.invalid);
    if (!parsed.ok) return;
    startTransition(() => {
      dispatch(formData);
    });
  }

  if (state.status === 'refused') return <RefusalNotice kind={state.refusal} deleted />;
  if (state.status === 'closed') return <RefusalNotice kind="closed" deleted />;

  const failed = state.status === 'error' && state.error !== 'eligibility';

  return (
    <form ref={form} noValidate onSubmit={submit} className="grid gap-6">
      <EligibilityFields countries={countries} invalid={invalid} />
      {failed ? <FormError>{errors('failed')}</FormError> : null}
      <div>
        <Button type="submit" variant="primary" disabled={pending}>
          {t('submit')}
        </Button>
      </div>
    </form>
  );
}
