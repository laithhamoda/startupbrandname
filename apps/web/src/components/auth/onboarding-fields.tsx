'use client';

import { useTranslations } from 'next-intl';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup } from '@/components/ui/radio-group';
import { SelectField } from '@/components/ui/select-field';
import { TextLink } from '@/components/ui/text-link';
import type { OnboardingAnswers, OnboardingField } from '@/lib/auth/onboarding';
import type { CountryOption } from '@/lib/countries';

interface OnboardingFieldsProps {
  countries: readonly CountryOption[];
  invalid?: readonly OnboardingField[];
  /** Answers to show again when the person comes back to this step. */
  defaults?: OnboardingAnswers | null;
}

/**
 * Country, "do you have a project or a project idea?" (information only, D-086), the terms, and
 * the optional, unticked cross-border consent that names the processor and its country
 * (SPEC §11, D-062).
 */
export function OnboardingFields({ countries, invalid = [], defaults }: OnboardingFieldsProps) {
  const t = useTranslations('aboutYou');
  const errorFor = (field: OnboardingField) => {
    if (!invalid.includes(field)) return undefined;
    return field === 'terms' ? t('termsRequired') : t('required');
  };

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
        name="project"
        label={t('project')}
        options={[
          { value: 'yes', label: t('yes') },
          { value: 'no', label: t('no') },
        ]}
        inline
        required
        defaultValue={defaults?.project}
        error={errorFor('project')}
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
export function OnboardingHiddenInputs({ answers }: { answers: OnboardingAnswers }) {
  return (
    <>
      <input type="hidden" name="country" value={answers.country} />
      <input type="hidden" name="project" value={answers.project} />
      <input type="hidden" name="terms" value={answers.terms} />
      {answers.crossborder ? (
        <input type="hidden" name="crossborder" value={answers.crossborder} />
      ) : null}
    </>
  );
}
