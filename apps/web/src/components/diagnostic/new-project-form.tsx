'use client';

import { useTranslations } from 'next-intl';
import { useActionState } from 'react';
import { FormError, submitTo, useFocusFirstInvalid } from '@/components/auth/form-helpers';
import { Button } from '@/components/ui/button';
import { RadioGroup } from '@/components/ui/radio-group';
import { SelectField } from '@/components/ui/select-field';
import { Field } from '@/components/ui/field';
import { TextInput, controlClass } from '@/components/ui/text-input';
import type { Locale } from '@/i18n/routing';
import {
  createProject,
  type NewProjectField,
  type NewProjectState,
} from '@/lib/diagnostic/actions';
import type { CurrencyOptions } from '@/lib/diagnostic/currencies';

/**
 * Name, country, currency and mode. The country starts as the account's; the currency is always
 * chosen, never preselected (D-111).
 */
export function NewProjectForm({
  locale,
  countries,
  currencies,
  defaultCountry,
}: {
  locale: Locale;
  countries: readonly { value: string; label: string }[];
  currencies: CurrencyOptions;
  defaultCountry: string;
}) {
  const t = useTranslations('projects');
  const [state, dispatch, pending] = useActionState<NewProjectState, FormData>(
    createProject.bind(null, locale),
    { status: 'idle' },
  );
  const form = useFocusFirstInvalid(state);
  const invalid = (name: NewProjectField) =>
    state.status === 'error' && state.invalid?.includes(name) ? t('fieldError') : undefined;

  return (
    <form ref={form} noValidate onSubmit={submitTo(dispatch)} className="grid gap-6">
      <Field id="project-title" label={t('name')} hint={t('nameHint')} error={invalid('title')}>
        {({ id, describedBy, invalid: isInvalid }) => (
          <TextInput
            id={id}
            name="title"
            dir="auto"
            maxLength={120}
            required
            aria-describedby={describedBy}
            aria-invalid={isInvalid || undefined}
          />
        )}
      </Field>
      <SelectField
        id="project-country"
        name="country"
        label={t('country')}
        hint={t('countryHint')}
        options={countries}
        defaultValue={defaultCountry}
        required
        error={invalid('country')}
      />
      <Field
        id="project-currency"
        label={t('currency')}
        hint={t('currencyHint')}
        error={invalid('currency')}
      >
        {({ id, describedBy, invalid: isInvalid }) => (
          <select
            id={id}
            name="currency"
            required
            defaultValue=""
            aria-describedby={describedBy}
            aria-invalid={isInvalid || undefined}
            className={controlClass}
          >
            <option value="" disabled>
              {t('chooseCurrency')}
            </option>
            <optgroup label={t('commonCurrencies')}>
              {currencies.common.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </optgroup>
            <optgroup label={t('allCurrencies')}>
              {currencies.others.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </optgroup>
          </select>
        )}
      </Field>
      <RadioGroup
        name="mode"
        label={t('mode')}
        defaultValue="quick"
        required
        error={invalid('mode')}
        options={[
          { value: 'quick', label: t('quick') },
          { value: 'full', label: t('full') },
        ]}
      />
      {state.status === 'error' && state.error !== 'invalid' ? (
        <FormError>{t(state.error === 'limit' ? 'limit' : 'failed')}</FormError>
      ) : null}
      <div>
        <Button type="submit" variant="primary" disabled={pending}>
          {t('create')}
        </Button>
      </div>
    </form>
  );
}
