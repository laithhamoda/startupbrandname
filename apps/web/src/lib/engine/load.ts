import 'server-only';
import type { ProvenanceBySteps, TaxRule } from '@sbn/engine';
import { type Answers, isQuestionId, findFollowUp, type StepId } from '@sbn/question-bank';
import { z } from 'zod';
import { answersOf, type Project, PROJECT_COLUMNS, toProject } from '@/lib/diagnostic/project';
import { errorFields, log } from '@/lib/log';
import type { SupabaseServerClient } from '@/lib/supabase/server';
import { toTaxRules } from './tax-rules';

/** What a run reads: the project, its answers with their provenance, and its country's tax rules. */
export interface RunSource {
  readonly project: Project;
  readonly answers: Answers;
  readonly provenance: ProvenanceBySteps;
  readonly taxRules: readonly TaxRule[];
  /**
   * False when the tax rules could not be read (the table may not exist yet on a database that
   * has not had the M5 migration, D-251): the run then has no tax regime, and it is not recorded,
   * because its hash would stand for rules it never saw.
   */
  readonly taxRulesRead: boolean;
}

const idSchema = z.uuid();

/** The three values stored next to an answer (CLAUDE.md rule 2). */
const provenanceSchema = z.object({
  source: z.enum(['user', 'assumption', 'external']),
  confidence: z.enum(['high', 'medium', 'low']),
  validated: z.boolean(),
});

function isStep(id: string): id is StepId {
  return isQuestionId(id) || findFollowUp(id) !== undefined;
}

/**
 * The stored provenance of each answer that could be read. A row whose provenance does not fit
 * the three values is left out, and the engine then treats that answer as an unvalidated
 * assumption, the safe reading (rule 2, D-104).
 */
export function provenanceOfRows(
  rows: readonly { question_id: string; source: string; confidence: string; validated: boolean }[],
  answers: Answers,
): ProvenanceBySteps {
  const provenance: ProvenanceBySteps = {};
  for (const row of rows) {
    if (!isStep(row.question_id) || !answers[row.question_id]) continue;
    const parsed = provenanceSchema.safeParse(row);
    if (parsed.success) provenance[row.question_id] = parsed.data;
  }
  return provenance;
}

/**
 * Reads one project for a run: the project and its answers with their provenance in one round trip
 * (RLS returns nothing for a project that is not the account's), then the tax rules of its country.
 * Null when the project does not exist or is not the account's. Throws when the database cannot
 * be reached, like the other loaders: the page's error boundary shows it. Tax rules the engine
 * cannot read are left out and logged by count (rule 9); tax rules that cannot be fetched at all
 * leave the run without a regime (`taxRulesRead` false).
 */
export async function loadRunSource(
  supabase: SupabaseServerClient,
  projectId: string,
): Promise<RunSource | null> {
  if (!idSchema.safeParse(projectId).success) return null;
  const [projectResult, answersResult] = await Promise.all([
    supabase.from('projects').select(PROJECT_COLUMNS).eq('id', projectId).maybeSingle(),
    supabase
      .from('answers')
      .select('question_id, normalized_value, source, confidence, validated')
      .eq('project_id', projectId),
  ]);
  if (projectResult.error) throw projectResult.error;
  if (!projectResult.data) return null;
  if (answersResult.error) throw answersResult.error;
  const project = toProject(projectResult.data);
  const answers = await answersOf(projectId, answersResult.data);

  const rulesResult = await supabase
    .from('tax_rules')
    .select('*')
    .eq('country_code', project.countryCode);
  if (rulesResult.error) {
    await log.warn('engine.tax_rules_unavailable', {
      ...errorFields(rulesResult.error),
      projectId,
    });
  }
  const { rules, skipped } = toTaxRules(rulesResult.data ?? []);
  if (skipped > 0) await log.warn('engine.tax_rules_unreadable', { projectId, count: skipped });

  return {
    project,
    answers,
    provenance: provenanceOfRows(answersResult.data, answers),
    taxRules: rules,
    taxRulesRead: rulesResult.error === null,
  };
}
