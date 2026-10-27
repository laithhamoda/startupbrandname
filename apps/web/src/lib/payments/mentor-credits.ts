import 'server-only';
import { log } from '@/lib/log';
import type { SupabaseServerClient } from '@/lib/supabase/server';

/**
 * The mentor messages that the packs bought for a project add (D-322), read through row level
 * security; a revoked credit (refunded) does not count. A read that fails gives none and is logged,
 * so a database error never opens more messages.
 */
export async function mentorCreditsOf(
  supabase: SupabaseServerClient,
  projectId: string,
): Promise<number> {
  const { data, error } = await supabase
    .from('mentor_credits')
    .select('messages')
    .eq('project_id', projectId)
    .is('revoked_at', null);
  if (error) {
    await log.error('payments.credits_read_failed', { code: error.code });
    return 0;
  }
  return data.reduce((sum, row) => sum + row.messages, 0);
}

/** Whether the mentor pack bought with checkout `ref` has been credited (the webhook arrived). */
export async function packArrived(supabase: SupabaseServerClient, ref: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('mentor_credits')
    .select('id')
    .eq('checkout_ref', ref)
    .maybeSingle();
  if (error) {
    await log.error('payments.credits_read_failed', { code: error.code });
    return false;
  }
  return data !== null;
}
