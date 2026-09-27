import 'server-only';
import {
  type Answer,
  type Answers,
  answerSchema,
  FOLLOW_UPS,
  getQuestion,
  isQuestionId,
  type Mode,
} from '@sbn/question-bank';
import { z } from 'zod';
import type { SupabaseServerClient } from '@/lib/supabase/server';

export interface Project {
  id: string;
  title: string;
  countryCode: string;
  currency: string;
  mode: Mode;
  createdAt: string;
  updatedAt: string;
}

const modeSchema = z.enum(['quick', 'full']);

function toProject(row: {
  id: string;
  title: string;
  country_code: string;
  currency: string;
  mode: string;
  created_at: string;
  updated_at: string;
}): Project {
  return {
    id: row.id,
    title: row.title,
    countryCode: row.country_code,
    currency: row.currency,
    mode: modeSchema.parse(row.mode),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Answers as the question bank understands them. A stored value that no longer fits its
 * question (edited outside the app, or from an older version) counts as missing, never as data.
 */
export function parseAnswers(
  rows: readonly { question_id: string; normalized_value: unknown }[],
): Answers {
  const answers: Answers = {};
  for (const row of rows) {
    const id = row.question_id;
    if (isQuestionId(id)) {
      const question = getQuestion(id);
      const parsed = answerSchema(question.field, question.allowUnknown).safeParse(
        row.normalized_value,
      );
      if (parsed.success) answers[id] = parsed.data;
      continue;
    }
    const followUp = FOLLOW_UPS.find((candidate) => candidate.id === id);
    if (!followUp) continue;
    const parsed = answerSchema(followUp.field, false).safeParse(row.normalized_value);
    if (parsed.success) answers[followUp.id] = parsed.data;
  }
  return answers;
}

const PROJECT_COLUMNS = 'id, title, country_code, currency, mode, created_at, updated_at';

/** The signed-in account's projects (RLS), newest first, each with its answers. */
export async function listProjects(
  supabase: SupabaseServerClient,
): Promise<{ project: Project; answers: Answers }[]> {
  const { data: projects, error } = await supabase
    .from('projects')
    .select(PROJECT_COLUMNS)
    .order('created_at', { ascending: false });
  if (error) throw error;
  if (projects.length === 0) return [];

  const { data: rows, error: answersError } = await supabase
    .from('answers')
    .select('project_id, question_id, normalized_value')
    .in(
      'project_id',
      projects.map((project) => project.id),
    );
  if (answersError) throw answersError;

  return projects.map((row) => ({
    project: toProject(row),
    answers: parseAnswers(rows.filter((answer) => answer.project_id === row.id)),
  }));
}

const idSchema = z.uuid();

/** One project and its answers, or null if it does not exist or is not the account's (RLS). */
export async function loadProject(
  supabase: SupabaseServerClient,
  id: string,
): Promise<{ project: Project; answers: Answers } | null> {
  if (!idSchema.safeParse(id).success) return null;
  const { data: row, error } = await supabase
    .from('projects')
    .select(PROJECT_COLUMNS)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!row) return null;

  const { data: rows, error: answersError } = await supabase
    .from('answers')
    .select('question_id, normalized_value')
    .eq('project_id', id);
  if (answersError) throw answersError;
  return { project: toProject(row), answers: parseAnswers(rows) };
}

/** Provenance stored with an answer (CLAUDE.md rule 2, D-104, D-114). */
export function provenanceOf(answer: Answer, fromRange: boolean) {
  if (answer.status === 'unknown') {
    return { source: 'assumption', confidence: 'low', validated: false } as const;
  }
  if (fromRange) return { source: 'assumption', confidence: 'medium', validated: false } as const;
  return { source: 'user', confidence: 'medium', validated: false } as const;
}
