import { z } from 'zod';
import { COUNTRY_CODES, type CountryCode } from '@/lib/countries';

/** Form field names shared by the signup form, the onboarding gate and the Server Actions. */
export const ELIGIBILITY_FIELDS = {
  country: 'country',
  secondary: 'secondary',
  adult: 'adult',
  terms: 'terms',
  crossborder: 'crossborder',
} as const;

const yesNo = z.enum(['yes', 'no']);
// Radix checkboxes submit "on" when ticked and nothing when not.
const ticked = z.literal('on');

/** Answers as submitted. Either declaration may be "no"; the caller decides what that means. */
export const eligibilityAnswersSchema = z.object({
  country: z.enum(COUNTRY_CODES),
  secondary: yesNo,
  adult: yesNo,
  terms: ticked,
  crossborder: ticked.optional(),
});

export type EligibilityAnswers = z.infer<typeof eligibilityAnswersSchema>;

export type EligibilityField = keyof EligibilityAnswers;

/** Reads the answers from a submitted form. Returns the fields that are missing or invalid. */
export function parseEligibility(
  formData: FormData,
): { ok: true; answers: EligibilityAnswers } | { ok: false; invalid: EligibilityField[] } {
  const result = eligibilityAnswersSchema.safeParse({
    country: formData.get(ELIGIBILITY_FIELDS.country) ?? undefined,
    secondary: formData.get(ELIGIBILITY_FIELDS.secondary) ?? undefined,
    adult: formData.get(ELIGIBILITY_FIELDS.adult) ?? undefined,
    terms: formData.get(ELIGIBILITY_FIELDS.terms) ?? undefined,
    crossborder: formData.get(ELIGIBILITY_FIELDS.crossborder) ?? undefined,
  });
  if (result.success) return { ok: true, answers: result.data };
  const invalid = new Set<EligibilityField>();
  for (const issue of result.error.issues) {
    const field = issue.path[0];
    if (typeof field === 'string' && field in ELIGIBILITY_FIELDS) {
      invalid.add(field as EligibilityField);
    }
  }
  return { ok: false, invalid: [...invalid] };
}

export type Refusal = 'secondary' | 'adult';

/** Which declaration rules the person out, if any (D-059). Secondary school is asked first. */
export function refusalOf(
  answers: Pick<EligibilityAnswers, 'secondary' | 'adult'>,
): Refusal | null {
  if (answers.secondary === 'no') return 'secondary';
  if (answers.adult === 'no') return 'adult';
  return null;
}

export function isClosedCountry(country: CountryCode, closed: readonly CountryCode[]): boolean {
  return closed.includes(country);
}
