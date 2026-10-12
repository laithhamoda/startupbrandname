import 'server-only';
import {
  ENGINE_VERSION,
  type EngineRun,
  type NotCalculableReason,
  type PricingOptions,
  runEngine,
} from '@sbn/engine';
import { reviewAnswer } from '@sbn/question-bank';
import { errorFields, log } from '@/lib/log';
import type { SupabaseServerClient } from '@/lib/supabase/server';
import { type RunInputs, inputHash } from './input-hash';
import { loadRunSource, type RunSource } from './load';
import { type RecordOutcome, recordEngineRun } from './record';
import { summaryOf } from './summary';

/** What running the engine on a project gave. */
export type EngineOutcome =
  | { status: 'ok'; run: EngineRun }
  /** The answers cannot be calculated yet: the reasons are shown in words (D-231). */
  | { status: 'not_calculable'; reasons: readonly NotCalculableReason[] }
  /** The engine refused its input (a malformed rule, say). Logged; the page still shows the chips. */
  | { status: 'failed' };

export interface ProjectAnalysis {
  readonly source: RunSource;
  readonly outcome: EngineOutcome;
  readonly inputHash: string;
  /** What happened to the record of the run; `skipped` when there was nothing to record. */
  readonly recorded: RecordOutcome | 'skipped';
}

/** The run's reference date, YYYY-MM-DD in UTC: month 1 is the calendar month after it (D-184). */
export function referenceDateOf(now: Date): string {
  return now.toISOString().slice(0, 10);
}

/**
 * Whether the founder's D5 answer passed rule R5 (a measurable difference), which lets the price
 * positions of T7 include a premium (D-189). Without a D5 answer it did not.
 */
export function pricingOptionsOf(source: RunSource): PricingOptions {
  const differentiation = source.answers.D5;
  const passed =
    differentiation?.status === 'answered' &&
    reviewAnswer('D5', differentiation, source.answers).every(
      (finding) => finding.code !== 'R5_vague',
    );
  return { premiumAllowed: passed };
}

/** Everything a run reads, in the form that is hashed. */
export function runInputsOf(source: RunSource, referenceDate: string): RunInputs {
  return {
    country: source.project.countryCode,
    currency: source.project.currency,
    mode: source.project.mode,
    referenceMonth: referenceDate.slice(0, 7),
    answers: source.answers,
    provenance: source.provenance,
    taxRules: source.taxRules,
    overrides: {},
    options: pricingOptionsOf(source),
  };
}

/**
 * Runs the engine on a loaded project. The engine is pure and fast (no database, no model), so the
 * page runs it on every visit; what is stored is the compact summary (D-238). A throw from the
 * engine is logged and returned as `failed`: the canvas does not depend on it (D-231).
 */
export async function runSource(source: RunSource, referenceDate: string): Promise<EngineOutcome> {
  const inputs = runInputsOf(source, referenceDate);
  try {
    const result = runEngine(
      source.answers,
      source.provenance,
      {
        country: inputs.country,
        currency: inputs.currency,
        mode: inputs.mode,
        referenceDate,
      },
      { rules: source.taxRules },
      inputs.overrides,
      inputs.options,
    );
    return result.status === 'ok'
      ? { status: 'ok', run: result.run }
      : { status: 'not_calculable', reasons: result.reasons };
  } catch (error) {
    await log.error('engine.run_failed', { ...errorFields(error), projectId: source.project.id });
    return { status: 'failed' };
  }
}

/**
 * Loads a project, runs the engine on its answers and, when the run is calculable and no row exists
 * for these inputs, records its summary (rule 4, D-238, D-251). Null when the project is not the
 * account's. A run is not recorded when the tax rules could not be read, because its hash would
 * stand for rules it never saw. Recording failures never reach the caller.
 */
export async function analyseProject(
  supabase: SupabaseServerClient,
  projectId: string,
  now: Date = new Date(),
): Promise<ProjectAnalysis | null> {
  const source = await loadRunSource(supabase, projectId);
  if (!source) return null;
  const referenceDate = referenceDateOf(now);
  const hash = inputHash(runInputsOf(source, referenceDate));
  const outcome = await runSource(source, referenceDate);
  const recorded =
    outcome.status === 'ok' && source.taxRulesRead
      ? await recordEngineRun(supabase, {
          projectId,
          inputHash: hash,
          engineVersion: ENGINE_VERSION,
          summary: summaryOf(outcome.run),
        })
      : 'skipped';
  return { source, outcome, inputHash: hash, recorded };
}
