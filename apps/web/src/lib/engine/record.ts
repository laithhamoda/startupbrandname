import 'server-only';
import { unstable_rethrow } from 'next/navigation';
import { errorFields, log } from '@/lib/log';
import type { Json } from '@/lib/supabase/database.types';
import type { SupabaseServerClient } from '@/lib/supabase/server';

/** The tool id of the engine's runs in `tool_runs` (D-238). */
export const ENGINE_TOOL_ID = 'engine';

export type RecordOutcome = 'recorded' | 'exists' | 'failed';

/**
 * Records the compact summary of a run unless the project already has a row for these inputs
 * (CLAUDE.md rule 4: unchanged inputs reuse the stored output). The check and the write are two
 * calls, so two pages opened at once may both write; the database makes that harmless, because
 * `record_engine_run` answers the existing row for the same hash (D-244).
 *
 * Recording is a side effect of looking at a page and must never break it: any failure is logged
 * with allowlisted fields and returned as `failed`. It is also expected on a database that has not
 * had the M5 migration yet, where the function does not exist.
 */
export async function recordEngineRun(
  supabase: SupabaseServerClient,
  run: { projectId: string; inputHash: string; engineVersion: string; summary: Json },
): Promise<RecordOutcome> {
  try {
    const existing = await supabase
      .from('tool_runs')
      .select('id')
      .eq('project_id', run.projectId)
      .eq('tool_id', ENGINE_TOOL_ID)
      .eq('input_hash', run.inputHash)
      .limit(1);
    if (existing.error) {
      await log.warn('engine.record_failed', {
        ...errorFields(existing.error),
        projectId: run.projectId,
        stage: 'lookup',
      });
      return 'failed';
    }
    if (existing.data.length > 0) return 'exists';

    const { error } = await supabase.rpc('record_engine_run', {
      p_project_id: run.projectId,
      p_tool_id: ENGINE_TOOL_ID,
      p_input_hash: run.inputHash,
      p_output: run.summary,
      p_engine_version: run.engineVersion,
    });
    if (error) {
      await log.warn('engine.record_failed', {
        ...errorFields(error),
        projectId: run.projectId,
        stage: 'record',
      });
      return 'failed';
    }
    return 'recorded';
  } catch (error) {
    // Next.js's own signals (a dynamic API, a redirect) must pass through.
    unstable_rethrow(error);
    await log.warn('engine.record_failed', {
      ...errorFields(error),
      projectId: run.projectId,
      stage: 'call',
    });
    return 'failed';
  }
}
