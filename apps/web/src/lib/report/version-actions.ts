'use server';

import { revalidatePath } from 'next/cache';
import { redirect, unstable_rethrow } from 'next/navigation';
import { z } from 'zod';
import { routing } from '@/i18n/routing';
import { requireAccount } from '@/lib/auth/session';
import { reportPath } from '@/lib/diagnostic/steps';
import { analyseProject } from '@/lib/engine/analyse';
import { errorFields, log } from '@/lib/log';

const localeSchema = z.enum(routing.locales);
const idSchema = z.uuid();
const numberSchema = z.coerce.number().int().min(1).max(99);

/** Why a version action did not go through, shown on the report page as `?version=<code>`. */
export type VersionErrorCode = 'none_left' | 'closed' | 'confirm' | 'failed';

/** SQLSTATEs of supabase/migrations/20261026203000_report_versions.sql. */
const CODES: Readonly<Record<string, VersionErrorCode>> = { SB002: 'none_left', SB003: 'closed' };

function back(locale: string, projectId: string, error?: VersionErrorCode): never {
  const query = error ? `?version=${error}` : '';
  redirect(`/${locale}${reportPath(projectId)}${query}`);
}

/**
 * Records the report of the project's current answers as its next version (D-321): the analysis
 * runs again here, on the server, so the input hash and the verdict are the ones the page shows.
 */
export async function makeReportVersion(localeInput: string, projectInput: string): Promise<void> {
  const locale = localeSchema.parse(localeInput);
  const projectId = idSchema.parse(projectInput);
  let error: VersionErrorCode | undefined;
  try {
    const { supabase } = await requireAccount(locale);
    const analysis = await analyseProject(supabase, projectId, new Date());
    if (analysis?.outcome.status !== 'ok') {
      error = 'failed';
    } else {
      const { error: rpcError } = await supabase.rpc('record_report_version', {
        p_project_id: projectId,
        p_input_hash: analysis.inputHash,
        p_verdict: analysis.outcome.run.verdict.verdict.value,
      });
      if (rpcError) {
        error = CODES[rpcError.code] ?? 'failed';
        if (error === 'failed') {
          await log.error('report.version_failed', { code: rpcError.code, projectId });
        }
      }
    }
  } catch (caught) {
    unstable_rethrow(caught);
    await log.error('report.version_failed', { ...errorFields(caught), projectId });
    error = 'failed';
  }
  revalidatePath(`/${locale}${reportPath(projectId)}`);
  back(locale, projectId, error);
}

/**
 * Makes one recorded version the project's final report (D-321): its answers come back and the
 * project closes to edits. The form asks the founder to confirm, since it cannot be undone.
 */
export async function chooseFinalVersion(
  localeInput: string,
  projectInput: string,
  formData: FormData,
): Promise<void> {
  const locale = localeSchema.parse(localeInput);
  const projectId = idSchema.parse(projectInput);
  const number = numberSchema.safeParse(formData.get('number'));
  if (formData.get('confirm') !== 'on' || !number.success) back(locale, projectId, 'confirm');
  let error: VersionErrorCode | undefined;
  try {
    const { supabase } = await requireAccount(locale);
    const { error: rpcError } = await supabase.rpc('choose_final_version', {
      p_project_id: projectId,
      p_number: number.data,
    });
    if (rpcError) {
      error = CODES[rpcError.code] ?? 'failed';
      if (error === 'failed') {
        await log.error('report.final_failed', { code: rpcError.code, projectId });
      }
    }
  } catch (caught) {
    unstable_rethrow(caught);
    await log.error('report.final_failed', { ...errorFields(caught), projectId });
    error = 'failed';
  }
  revalidatePath(`/${locale}${reportPath(projectId)}`, 'layout');
  back(locale, projectId, error);
}
