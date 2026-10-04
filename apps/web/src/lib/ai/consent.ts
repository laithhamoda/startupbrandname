import 'server-only';
import { z } from 'zod';
import { CROSSBORDER_VERSION } from '@/config/legal';
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

/**
 * The consent state as the database counts it, or null on the previous schema (before migration
 * 20261004053600), which cannot tell the versions of the text apart. The AI review runs only on
 * `current` from here, so it stays off on a database that is migrated in part (D-155). Throws
 * when the database cannot answer.
 */
export async function crossborderConsentState(
  supabase: SupabaseServerClient,
): Promise<ConsentState | null> {
  const { data, error } = await supabase.rpc('crossborder_consent_state');
  if (error?.code === MISSING_FUNCTION) return null;
  if (error) throw error;
  return consentStateSchema.parse(data);
}

/**
 * The consent state the account page shows. On the previous schema it compares the latest
 * consent event with CROSSBORDER_VERSION itself, so a consent to an earlier text shows as
 * outdated there as well; its renewal is recorded only once the migration has run, since the
 * earlier set_crossborder_consent() skips a consent that is already given. Throws when the
 * database cannot answer.
 */
export async function accountConsentState(
  supabase: SupabaseServerClient,
  userId: string,
): Promise<ConsentState> {
  const state = await crossborderConsentState(supabase);
  if (state) return state;
  const { data, error } = await supabase
    .from('consent_events')
    .select('action, text_version')
    .eq('user_id', userId)
    .eq('kind', 'crossborder')
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (data?.action !== 'given') return 'none';
  return data.text_version === CROSSBORDER_VERSION ? 'current' : 'outdated';
}

/**
 * The consent state for a page that only adapts to it (the diagnostic step), or null when it
 * cannot be read (logged) or the database is not migrated yet: the page then shows no consent
 * prompt and no review label, as the review is off.
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
