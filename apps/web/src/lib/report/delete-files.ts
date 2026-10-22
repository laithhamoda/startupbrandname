import 'server-only';
import { errorFields, log } from '@/lib/log';
import type { SupabaseServerClient } from '@/lib/supabase/server';
import { REPORTS_BUCKET } from './pdf';

/** Entries asked of the Storage API at a time, and the most pages one folder may have. */
const PAGE_SIZE = 100;
const MAX_PAGES = 50;

interface Listed {
  readonly name: string;
  /** A folder has no id in the Storage API's listing. */
  readonly id: string | null;
}

/** Everything in one folder, a page at a time; null when a call failed. */
async function listFolder(
  supabase: SupabaseServerClient,
  folder: string,
): Promise<readonly Listed[] | null> {
  const entries: Listed[] = [];
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const { data, error } = await supabase.storage
      .from(REPORTS_BUCKET)
      .list(folder, { limit: PAGE_SIZE, offset: page * PAGE_SIZE });
    if (error) {
      await log.error('account.reports_list_failed', { ...errorFields(error), stage: 'list' });
      return null;
    }
    entries.push(...data);
    if (data.length < PAGE_SIZE) return entries;
  }
  await log.error('account.reports_list_failed', { stage: 'too_many' });
  return null;
}

/**
 * Removes every stored report PDF of the signed-in user from the private bucket, before the
 * account (or one project, when projectId is given) is deleted (M5 step 6, D-283). Deleting the rows does not delete the files (D-234), so
 * the files go first, through the Storage API with the user's own session: an empty folder is
 * fine, and any call that fails, or removes fewer files than were asked for (the Storage API
 * answers a refused file with no error), makes this return false so the account is kept and the
 * founder can try again. The retention job of M9 must do the same with the service role.
 */
export async function removeReportFiles(
  supabase: SupabaseServerClient,
  userId: string,
  projectId?: string,
): Promise<boolean> {
  // One project: only its folder. The whole account: every folder of the user.
  const projects =
    projectId === undefined
      ? await listFolder(supabase, userId)
      : [{ name: projectId, id: null } as Listed];
  if (projects === null) return false;

  const paths: string[] = [];
  for (const entry of projects) {
    if (entry.id === null) {
      const files = await listFolder(supabase, `${userId}/${entry.name}`);
      if (files === null) return false;
      for (const file of files) {
        if (file.id !== null) paths.push(`${userId}/${entry.name}/${file.name}`);
      }
    } else {
      // A file straight under the user's folder: never written by the app, but it is theirs too.
      paths.push(`${userId}/${entry.name}`);
    }
  }

  for (let start = 0; start < paths.length; start += PAGE_SIZE) {
    const batch = paths.slice(start, start + PAGE_SIZE);
    const { data, error } = await supabase.storage.from(REPORTS_BUCKET).remove(batch);
    if (error || data.length !== batch.length) {
      await log.error('account.reports_remove_failed', {
        ...(error ? errorFields(error) : {}),
        stage: 'remove',
        count: batch.length,
      });
      return false;
    }
  }
  if (paths.length > 0) await log.info('account.reports_removed', { count: paths.length });
  return true;
}
