'use client';

import { useLocale, useTranslations } from 'next-intl';
import { type SubmitEvent, startTransition, useActionState, useState } from 'react';
import { Button } from '@/components/ui/button';
import { type AuthFormState, submitOnboarding } from '@/lib/auth/actions';
import { type OnboardingField, parseOnboarding } from '@/lib/auth/onboarding';
import type { CountryOption } from '@/lib/countries';
import { FormError, useFocusFirstInvalid } from './form-helpers';
import { OnboardingFields } from './onboarding-fields';

const IDLE: AuthFormState = { status: 'idle' };

/**
 * The onboarding gate for an account that has not answered the first signup step, typically one
 * created by Google (D-065). A country where signup is closed deletes the account on the server,
 * then shows /not-available.
 */
export function OnboardingForm({ countries }: { countries: readonly CountryOption[] }) {
  const locale = useLocale();
  const t = useTranslations('onboarding');
  const errors = useTranslations('auth.errors');
  const [invalid, setInvalid] = useState<OnboardingField[]>([]);
  const [state, dispatch, pending] = useActionState(submitOnboarding.bind(null, locale), IDLE);
  const form = useFocusFirstInvalid(invalid);

  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const parsed = parseOnboarding(formData);
    setInvalid(parsed.ok ? [] : parsed.invalid);
    if (!parsed.ok) return;
    startTransition(() => {
      dispatch(formData);
    });
  }

  // Success and a closed country both redirect; only errors come back here.
  const failed = state.status === 'error' && state.error !== 'answers';

  return (
    <form ref={form} noValidate onSubmit={submit} className="grid gap-6">
      <OnboardingFields countries={countries} invalid={invalid} />
      {failed ? <FormError>{errors('failed')}</FormError> : null}
      <div>
        <Button type="submit" variant="primary" disabled={pending}>
          {t('submit')}
        </Button>
      </div>
    </form>
  );
}
