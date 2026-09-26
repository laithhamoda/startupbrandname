import { z } from 'zod';
import { COUNTRY_CODES } from '@/lib/countries';

/**
 * The first signup step and the onboarding gate ask the same things (D-086): the country, whether
 * the person has a project or a project idea (information only), the terms, and the optional
 * cross-border consent. Nothing here refuses anyone; the age check comes at payment (M7).
 */
const yesNo = z.enum(['yes', 'no']);
// Radix checkboxes submit "on" when ticked and nothing when not.
const ticked = z.literal('on');

export const onboardingAnswersSchema = z.object({
  country: z.enum(COUNTRY_CODES),
  project: yesNo,
  terms: ticked,
  crossborder: ticked.optional(),
});

export type OnboardingAnswers = z.infer<typeof onboardingAnswersSchema>;

export type OnboardingField = keyof OnboardingAnswers;

const FIELDS: readonly OnboardingField[] = ['country', 'project', 'terms', 'crossborder'];

/** Reads the answers from a submitted form. Returns the fields that are missing or invalid. */
export function parseOnboarding(
  formData: FormData,
): { ok: true; answers: OnboardingAnswers } | { ok: false; invalid: OnboardingField[] } {
  const result = onboardingAnswersSchema.safeParse(
    Object.fromEntries(FIELDS.map((field) => [field, formData.get(field) ?? undefined])),
  );
  if (result.success) return { ok: true, answers: result.data };
  const invalid = new Set<OnboardingField>();
  for (const issue of result.error.issues) {
    const field = issue.path[0];
    if (typeof field === 'string' && (FIELDS as readonly string[]).includes(field)) {
      invalid.add(field as OnboardingField);
    }
  }
  return { ok: false, invalid: [...invalid] };
}
