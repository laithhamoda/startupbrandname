'use client';

import { useTranslations } from 'next-intl';
import { useActionState } from 'react';
import { FormError, submitTo, useFocusFirstInvalid } from '@/components/auth/form-helpers';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Field } from '@/components/ui/field';
import { SelectField } from '@/components/ui/select-field';
import { TextInput, controlClass } from '@/components/ui/text-input';
import { TextLink } from '@/components/ui/text-link';
import type { Locale } from '@/i18n/routing';
import type { CurrencyOptions } from '@/lib/diagnostic/currencies';
import { startVisit, type StartField, type StartState } from '@/lib/start/actions';

/**
 * The first visit without signup (D-350): the idea, the country and the currency, then the consent
 * that comes after the idea is written and before anything reaches the model. One button.
 */
export function StartForm({
  locale,
  countries,
  currencies,
}: {
  locale: Locale;
  countries: readonly { value: string; label: string }[];
  currencies: CurrencyOptions;
}) {
  const t = useTranslations('start');
  const projects = useTranslations('projects');
  const about = useTranslations('aboutYou');
  const [state, dispatch, pending] = useActionState<StartState, FormData>(
    startVisit.bind(null, locale),
    { status: 'idle' },
  );
  const form = useFocusFirstInvalid(state);
  const invalid = (name: StartField) =>
    state.status === 'error' && state.invalid?.includes(name) ? about('required') : undefined;

  return (
    <form ref={form} noValidate onSubmit={submitTo(dispatch)} className="grid gap-6">
      <Field id="start-title" label={t('idea')} hint={t('ideaHint')} error={invalid('title')}>
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
        id="start-country"
        name="country"
        label={about('country')}
        hint={about('countryHint')}
        placeholder={about('countryPlaceholder')}
        options={countries}
        required
        error={invalid('country')}
      />
      <Field
        id="start-currency"
        label={projects('currency')}
        hint={projects('currencyHint')}
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
              {projects('chooseCurrency')}
            </option>
            <optgroup label={projects('commonCurrencies')}>
              {currencies.common.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </optgroup>
            <optgroup label={projects('allCurrencies')}>
              {currencies.others.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </optgroup>
          </select>
        )}
      </Field>

      <fieldset className="grid gap-4 border-0 p-0">
        <legend className="font-bold">{t('consentTitle')}</legend>
        <p className="reading text-small text-ink-2">{t('consentIntro')}</p>
        <Checkbox
          id="start-terms"
          name="terms"
          required
          error={invalid('terms') ? about('termsRequired') : undefined}
          label={about.rich('terms', {
            terms: (chunks) => (
              <TextLink href="/terms" target="_blank">
                {chunks}
              </TextLink>
            ),
            privacy: (chunks) => (
              <TextLink href="/privacy" target="_blank">
                {chunks}
              </TextLink>
            ),
          })}
        />
        <Checkbox
          id="start-crossborder"
          name="crossborder"
          label={about('crossborder')}
          hint={about('crossborderHint')}
        />
      </fieldset>

      {state.status === 'error' && state.error !== 'invalid' ? (
        <FormError>{t(`errors.${state.error}`)}</FormError>
      ) : null}
      <div>
        <Button type="submit" variant="primary" disabled={pending}>
          {t('submit')}
        </Button>
      </div>
    </form>
  );
}
