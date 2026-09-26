'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useActionState } from 'react';
import { FormError, submitTo } from '@/components/auth/form-helpers';
import { Button } from '@/components/ui/button';
import { SelectField } from '@/components/ui/select-field';
import { type AccountFormState, updatePreferences } from '@/lib/auth/actions';
import type { CountryOption } from '@/lib/countries';

const IDLE: AccountFormState = { status: 'idle' };

// Each language is named in itself, so it can be found whichever language is on screen.
const LANGUAGES = [
  { value: 'ar', label: 'العربية' },
  { value: 'en', label: 'English' },
] as const;

export function PreferencesForm({
  countries,
  country,
  language,
}: {
  countries: readonly CountryOption[];
  country: string;
  language: string;
}) {
  const locale = useLocale();
  const t = useTranslations('account');
  const aboutYou = useTranslations('aboutYou');
  const errors = useTranslations('auth.errors');
  const [state, dispatch, pending] = useActionState(updatePreferences.bind(null, locale), IDLE);

  return (
    <form noValidate onSubmit={submitTo(dispatch)} className="grid max-w-md gap-5">
      <SelectField
        id="country"
        name="country"
        label={aboutYou('country')}
        options={countries}
        defaultValue={country}
        required
      />
      <SelectField
        id="language"
        name="language"
        label={t('language')}
        hint={t('languageHint')}
        options={LANGUAGES}
        defaultValue={language}
        required
      />
      {state.status === 'error' ? <FormError>{errors('failed')}</FormError> : null}
      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" disabled={pending}>
          {t('save')}
        </Button>
        {state.status === 'saved' ? (
          <p role="status" className="text-small text-ink-2">
            {t('saved')}
          </p>
        ) : null}
      </div>
    </form>
  );
}
