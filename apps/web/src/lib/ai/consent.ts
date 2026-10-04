import 'server-only';
import { z } from 'zod';
import { errorFields, log } from '@/lib/log';
import type { SupabaseServerClient } from '@/lib/supabase/server';

/**
 * The signed-in user's cross-border consent (D-147): `current` when it was given to a version of
 * the text listed in settings, `outdated` when it was given to an earlier text (the account page
 * asks to renew it), `none` when it was never given or was withdrawn. Only `current` lets the AI
 * review run.
 */
export const consentStateSchema = z.enum(['current', 'outdated', 'none']);
export type ConsentState = z.infer<typeof consentStateSchema>;

/** PostgREST's code for a function the database does not have. */
const MISSING_FUNCTION = 'PGRST202';

/** The consent state; throws when the database cannot answer. */
export async function crossborderConsentState(
  supabase: SupabaseServerClient,
): Promise<ConsentState> {
  const { data, error } = await supabase.rpc('crossborder_consent_state');
  if (!error) return consentStateSchema.parse(data);
  if (error.code !== MISSING_FUNCTION) throw error;
  // Until production has the migration (release order, D-132), the earlier function answers, so
  // the account page keeps working. AI stays off there: reserve_ai_run() is missing as well.
  const legacy = await supabase.rpc('has_crossborder_consent');
  if (legacy.error) throw legacy.error;
  return legacy.data ? 'current' : 'none';
}

/**
 * The consent state for a page that only adapts to it (the diagnostic step), or null after
 * logging why when it cannot be read: the page then shows no consent prompt.
 */
export async function consentStateOrNull(
  supabase: SupabaseServerClient,
): Promise<ConsentState | null> {
  try {
    return await crossborderConsentState(supabase);
  } catch (error) {
    await log.warn('ai.consent_unreadable', errorFields(error));
    return null;
  }
}
