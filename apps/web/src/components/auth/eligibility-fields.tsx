'use client';

import { useTranslations } from 'next-intl';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup } from '@/components/ui/radio-group';
import { SelectField } from '@/components/ui/select-field';
import { TextLink } from '@/components/ui/text-link';
import type { EligibilityAnswers, EligibilityField } from '@/lib/auth/eligibility';
import type { CountryOption } from '@/lib/countries';

interface EligibilityFieldsProps {
  countries: readonly CountryOption[];
  invalid?: readonly EligibilityField[];
  /** Answers to show again when the person comes back to this step. */
  defaults?: EligibilityAnswers | null;
}

/**
 * The signup gate (D-059): country, the two declarations, the terms, and the optional,
 * unticked cross-border consent that names the processor and its country (SPEC §11, D-062).
 * No date of birth is asked.
 */
export function EligibilityFields({ countries, invalid = [], defaults }: EligibilityFieldsProps) {
  const t = useTranslations('eligibility');
  const errorFor = (field: EligibilityField) => {
    if (!invalid.includes(field)) return undefined;
    return field === 'terms' ? t('termsRequired') : t('required');
  };
  const yesNo = [
    { value: 'yes', label: t('yes') },
    { value: 'no', label: t('no') },
  ];

  return (
    <div className="grid gap-6">
      <SelectField
        id="country"
        name="country"
        label={t('country')}
        hint={t('countryHint')}
        placeholder={t('countryPlaceholder')}
        options={countries}
        required
        defaultValue={defaults?.country}
        error={errorFor('country')}
      />
      <RadioGroup
        name="secondary"
        label={t('secondary')}
        options={yesNo}
        inline
        required
        defaultValue={defaults?.secondary}
        error={errorFor('secondary')}
      />
      <RadioGroup
        name="adult"
        label={t('adult')}
        options={yesNo}
        inline
        required
        defaultValue={defaults?.adult}
        error={errorFor('adult')}
      />
      <Checkbox
        id="terms"
        name="terms"
        required
        defaultChecked={defaults?.terms === 'on'}
        error={errorFor('terms')}
        label={t.rich('terms', {
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
        id="crossborder"
        name="crossborder"
        defaultChecked={defaults?.crossborder === 'on'}
        label={t('crossborder')}
        hint={t('crossborderHint')}
      />
    </div>
  );
}

/** The answers carried into the next step's forms, so the server checks them again. */
export function EligibilityHiddenInputs({ answers }: { answers: EligibilityAnswers }) {
  return (
    <>
      <input type="hidden" name="country" value={answers.country} />
      <input type="hidden" name="secondary" value={answers.secondary} />
      <input type="hidden" name="adult" value={answers.adult} />
      <input type="hidden" name="terms" value={answers.terms} />
      {answers.crossborder ? (
        <input type="hidden" name="crossborder" value={answers.crossborder} />
      ) : null}
    </>
  );
}
