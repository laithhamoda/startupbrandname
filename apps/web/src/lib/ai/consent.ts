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

/**
 * The consent state as the database counts it. Throws when the database cannot answer, a missing
 * crossborder_consent_state() included: the caller then fails closed, with AI off and the fixed
 * checks saving the answer (D-191). A failure is never read as consent.
 */
export async function crossborderConsentState(
  supabase: SupabaseServerClient,
): Promise<ConsentState> {
  const { data, error } = await supabase.rpc('crossborder_consent_state');
  if (error) throw error;
  return consentStateSchema.parse(data);
}

/**
 * The consent state for a page that only adapts to it, or null when it cannot be read (logged as
 * an error). The diagnostic step then shows no consent prompt and no review label, as the review
 * is off; the account page shows the consent as not active.
 */
export async function consentStateOrNull(
  supabase: SupabaseServerClient,
): Promise<ConsentState | null> {
  try {
    return await crossborderConsentState(supabase);
  } catch (error) {
    await log.error('ai.consent_unreadable', errorFields(error));
    return null;
  }
}
