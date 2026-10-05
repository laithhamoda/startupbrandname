import { isCountryCode } from '@/lib/countries';
import type { OnboardingAnswers, OnboardingField } from './onboarding';

/**
 * The browser's check of the first signup step and the onboarding gate (PERF-15). It applies the
 * rules of `parseOnboarding` without zod, so these two pages no longer ship zod and its locale
 * packs (91 KB gzipped) to check four fields. The server checks the answers again with the zod
 * schema (rule 7); `onboarding-check.test.ts` proves that both give the same result.
 */

/** The answers in the order they are asked, which is the order of `invalid`. */
export const ONBOARDING_FIELDS: readonly OnboardingField[] = [
  'country',
  'project',
  'terms',
  'crossborder',
];

export type OnboardingResult =
  { ok: true; answers: OnboardingAnswers } | { ok: false; invalid: OnboardingField[] };

/** Reads the answers from a submitted form. Returns the fields that are missing or invalid. */
export function checkOnboarding(formData: FormData): OnboardingResult {
  const country = formData.get('country');
  const project = formData.get('project');
  const terms = formData.get('terms');
  const crossborder = formData.get('crossborder');

  const countryCode = typeof country === 'string' && isCountryCode(country) ? country : null;
  const projectAnswer = project === 'yes' || project === 'no' ? project : null;
  // Radix checkboxes submit "on" when ticked and nothing when not.
  const consentValid = crossborder === null || crossborder === 'on';

  if (countryCode && projectAnswer && terms === 'on' && consentValid) {
    return {
      ok: true,
      answers: {
        country: countryCode,
        project: projectAnswer,
        terms,
        ...(crossborder === 'on' ? { crossborder } : {}),
      },
    };
  }
  const valid: Record<OnboardingField, boolean> = {
    country: countryCode !== null,
    project: projectAnswer !== null,
    terms: terms === 'on',
    crossborder: consentValid,
  };
  return { ok: false, invalid: ONBOARDING_FIELDS.filter((field) => !valid[field]) };
}
