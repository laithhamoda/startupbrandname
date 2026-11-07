'use server';

import { randomUUID } from 'node:crypto';
import { diagnosticSequence, isCurrencyCode } from '@sbn/question-bank';
import { redirect, unstable_rethrow } from 'next/navigation';
import { z } from 'zod';
import { getServerEnv } from '@/env/server';
import { type Locale, routing } from '@/i18n/routing';
import { allowAuthAttempt } from '@/lib/auth/rate-limit';
import { completeOnboarding, getSessionUser } from '@/lib/auth/session';
import { COUNTRY_CODES } from '@/lib/countries';
import { projectPath, stepPath } from '@/lib/diagnostic/steps';
import { errorFields, log } from '@/lib/log';
import { closedCountries } from '@/lib/markets';
import { createSupabaseServerClient } from '@/lib/supabase/server';

// The first visit without signup (D-335, D-350). The visitor writes the idea, chooses the country and the
// currency, accepts the terms (and, if they wish, the cross-border consent, shown after the idea and
// before anything is sent to the model), and is signed in anonymously. Their answers live under that
// identity; signing in later adds the email to the same identity (step 4).

const localeSchema = z.enum(routing.locales);

const startSchema = z.object({
  title: z.string().trim().min(1).max(120),
  country: z.enum(COUNTRY_CODES),
  currency: z.string().refine(isCurrencyCode),
  // Radix checkboxes submit "on" when ticked and nothing when not.
  terms: z.literal('on'),
  crossborder: z.literal('on').optional(),
});
const startFields = startSchema.keyof();

/** The start form's fields, named as the schema names them. */
export type StartField = z.infer<typeof startFields>;

export type StartState =
  | { status: 'idle' }
  | {
      status: 'error';
      error: 'invalid' | 'closed' | 'limited' | 'unavailable' | 'failed';
      invalid?: StartField[];
    };

/** The SQLSTATE create_project() raises when the account already has a project (D-109). */
const PROJECT_LIMIT_SQLSTATE = 'SB001';

export async function startVisit(
  localeInput: Locale,
  _previous: StartState,
  formData: FormData,
): Promise<StartState> {
  const locale = localeSchema.parse(localeInput);
  const parsed = startSchema.safeParse({
    title: formData.get('title') ?? '',
    country: formData.get('country') ?? '',
    currency: formData.get('currency') ?? '',
    terms: formData.get('terms') ?? undefined,
    crossborder: formData.get('crossborder') ?? undefined,
  });
  if (!parsed.success) {
    const invalid = parsed.error.issues.flatMap((issue) => {
      const field = startFields.safeParse(issue.path[0]);
      return field.success ? [field.data] : [];
    });
    return { status: 'error', error: 'invalid', invalid: [...new Set(invalid)] };
  }
  const { title, country, currency, crossborder } = parsed.data;

  try {
    const supabase = await createSupabaseServerClient();
    const existing = await getSessionUser(supabase);
    // An account has its own page for a new project; a visit already begun goes on where it stopped.
    if (existing && !existing.isAnonymous) redirect(`/${locale}/projects/new`);

    if (closedCountries(getServerEnv()).includes(country)) {
      return { status: 'error', error: 'closed' };
    }

    if (!existing) {
      // Counted per network before Supabase is called (D-340); a fresh subject each time, so only the
      // network is limited.
      if (!(await allowAuthAttempt('start', randomUUID()))) {
        return { status: 'error', error: 'limited' };
      }
      const { error } = await supabase.auth.signInAnonymously();
      if (error) {
        // Anonymous sign-ins switched off at Supabase, or over its own limit.
        await log.warn('start.anonymous_refused', { code: error.code ?? 'unknown' });
        return { status: 'error', error: 'unavailable' };
      }
    }

    await completeOnboarding(supabase, {
      country,
      locale,
      hasProject: true,
      crossborder: crossborder === 'on',
    });

    const { data: id, error } = await supabase.rpc('create_project', {
      p_title: title,
      p_country_code: country,
      p_currency: currency,
      // The owner's decision (D-344): a visitor answers all 64 questions.
      p_mode: 'full',
    });
    if (error) {
      if (error.code === PROJECT_LIMIT_SQLSTATE) {
        // This visitor already has their one project: take them back to it.
        const { data: rows } = await supabase
          .from('projects')
          .select('id')
          .order('created_at', { ascending: false })
          .limit(1);
        const first = rows?.[0];
        if (first) redirect(`/${locale}${projectPath(first.id)}`);
      }
      await log.error('start.create_failed', errorFields(error));
      return { status: 'error', error: 'failed' };
    }

    const first = diagnosticSequence('full', {})[0] ?? 'A1';
    redirect(`/${locale}${stepPath(id, first)}`);
  } catch (error) {
    unstable_rethrow(error);
    await log.error('start.failed', errorFields(error));
    return { status: 'error', error: 'failed' };
  }
}
