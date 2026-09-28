'use server';

import {
  type Answer,
  type Answers,
  activeFollowUps,
  type Finding,
  type QuestionId,
  answerSchema,
  diagnosticSequence,
  FOLLOW_UPS,
  getQuestion,
  isCurrencyCode,
  isQuestionId,
  type Language,
  nextStep,
  rangeValue,
  reviewAnswer,
  reviewProject,
  VALUE_ISSUES,
} from '@sbn/question-bank';
import { needsConfirmation } from '@sbn/ai';
import { getTranslations } from 'next-intl/server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { type Locale, routing } from '@/i18n/routing';
import type { Json } from '@/lib/supabase/database.types';
import { aiFindings } from '@/lib/ai/findings';
import { reviewWithAi } from '@/lib/ai/service';
import { requireAccount } from '@/lib/auth/session';
import { isCountryCode } from '@/lib/countries';
import { errorFields, log } from '@/lib/log';
import { type FindingView, viewFinding } from './findings';
import { loadProject, provenanceOf } from './project';
import { projectPath, stepFromSlug, stepPath } from './steps';

// Every action receives the page locale explicitly (Server Actions cannot read [locale]) and
// validates all input: the question bank decides what an answer may be (CLAUDE.md rule 7).

const localeSchema = z.enum(routing.locales);
const modeSchema = z.enum(['quick', 'full']);

// -----------------------------------------------------------------------------------------------
// New project
// -----------------------------------------------------------------------------------------------

export type NewProjectState =
  | { status: 'idle' }
  | {
      status: 'error';
      error: 'invalid' | 'limit' | 'failed';
      invalid?: ('title' | 'country' | 'currency' | 'mode')[];
    };

const newProjectSchema = z.object({
  title: z.string().trim().min(1).max(120),
  country: z.string().refine(isCountryCode),
  currency: z.string().refine(isCurrencyCode),
  mode: modeSchema,
});

export async function createProject(
  localeInput: Locale,
  _previous: NewProjectState,
  formData: FormData,
): Promise<NewProjectState> {
  const locale = localeSchema.parse(localeInput);
  const parsed = newProjectSchema.safeParse({
    title: formData.get('title') ?? '',
    country: formData.get('country') ?? '',
    currency: formData.get('currency') ?? '',
    mode: formData.get('mode') ?? '',
  });
  if (!parsed.success) {
    const invalid = [...new Set(parsed.error.issues.map((issue) => issue.path[0]))] as (
      'title' | 'country' | 'currency' | 'mode'
    )[];
    return { status: 'error', error: 'invalid', invalid };
  }

  const { supabase } = await requireAccount(locale);
  const { data: id, error } = await supabase.rpc('create_project', {
    p_title: parsed.data.title,
    p_country_code: parsed.data.country,
    p_currency: parsed.data.currency,
    p_mode: parsed.data.mode,
  });
  if (error) {
    if (error.code === 'SB001') return { status: 'error', error: 'limit' };
    await log.error('diagnostic.create_failed', errorFields(error));
    return { status: 'error', error: 'failed' };
  }

  revalidatePath(`/${locale}/projects`);
  const first = diagnosticSequence(parsed.data.mode, {})[0] ?? 'A1';
  redirect(`/${locale}${stepPath(id, first)}`);
}

// -----------------------------------------------------------------------------------------------
// Answers
// -----------------------------------------------------------------------------------------------

const submissionSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('value'),
    value: z.unknown(),
    rawText: z.string().max(8000).optional(),
  }),
  z.object({ kind: z.literal('unknown') }),
  z.object({ kind: z.literal('range'), min: z.number(), max: z.number().optional() }),
  /** The founder confirmed the AI's reading of a dialect answer (D-119); resent as typed. */
  z.object({ kind: z.literal('confirmed'), value: z.unknown() }),
]);

const saveSchema = z.object({
  locale: localeSchema,
  projectId: z.uuid(),
  step: z.string().max(8),
  submission: submissionSchema,
});

export type SaveInput = z.input<typeof saveSchema>;

export type SaveResult =
  /** Saved. `notes` are warnings about the new answer; `next` is null at the end. */
  | { status: 'saved'; next: string | null; notes: FindingView[] }
  /** Not saved: a rule asks for another answer, or a clarification (SPEC §2). */
  | { status: 'rejected'; findings: FindingView[] }
  /** Not saved: the answer does not fit the question. Messages in the page language. */
  | { status: 'invalid'; messages: string[] }
  /** Not saved yet: confirm the AI's reading of a dialect answer first (D-119). */
  | { status: 'confirm'; text: string }
  | { status: 'error' };

async function issueMessages(
  issues: readonly z.core.$ZodIssue[],
  language: Language,
): Promise<string[]> {
  const t = await getTranslations({ locale: language, namespace: 'diagnostic.errors' });
  const messages = issues.map((issue) => {
    if (issue.code === 'custom' && (VALUE_ISSUES as readonly string[]).includes(issue.message)) {
      return t(issue.message as (typeof VALUE_ISSUES)[number]);
    }
    if (issue.code === 'too_small' && issue.origin === 'array') {
      return t('minItems', { count: Number(issue.minimum) });
    }
    if ((issue.code === 'too_small' || issue.code === 'too_big') && issue.origin === 'number') {
      return t('outOfRange');
    }
    if (issue.code === 'too_big' && issue.origin === 'string') return t('tooLong');
    if (issue.code === 'invalid_format') return t('url');
    return t('required');
  });
  return [...new Set(messages)];
}

/** Findings that stop the save: a rule asks for another answer or a clarification (SPEC §2). */
function blockingFindings(questionId: QuestionId, answer: Answer, answers: Answers): Finding[] {
  return reviewAnswer(questionId, answer, answers).filter(
    (finding) => finding.severity === 'reject' || finding.severity === 'ask',
  );
}

/** Removes stored follow-ups that the answers no longer call for (one source of truth). */
async function dropInactiveFollowUps(
  supabase: Awaited<ReturnType<typeof requireAccount>>['supabase'],
  projectId: string,
  answers: Answers,
): Promise<Answers> {
  const active = new Set(activeFollowUps(answers).map((followUp) => followUp.id));
  const stale = FOLLOW_UPS.filter((followUp) => answers[followUp.id] && !active.has(followUp.id));
  if (stale.length === 0) return answers;
  const { error } = await supabase
    .from('answers')
    .delete()
    .eq('project_id', projectId)
    .in(
      'question_id',
      stale.map((followUp) => followUp.id),
    );
  if (error) throw error;
  const staleIds = new Set<string>(stale.map((followUp) => followUp.id));
  return Object.fromEntries(Object.entries(answers).filter(([id]) => !staleIds.has(id)));
}

export async function saveAnswer(input: SaveInput): Promise<SaveResult> {
  const parsedInput = saveSchema.safeParse(input);
  if (!parsedInput.success) return { status: 'error' };
  const { locale, projectId, submission } = parsedInput.data;
  const step = stepFromSlug(parsedInput.data.step.replace('.', '-'));
  if (!step) return { status: 'error' };

  const { supabase, user } = await requireAccount(locale);
  const loaded = await loadProject(supabase, projectId);
  if (!loaded) return { status: 'error' };
  const { project, answers } = loaded;

  const coreId = isQuestionId(step) ? step : null;
  const followUp = coreId ? null : FOLLOW_UPS.find((candidate) => candidate.id === step);
  if (followUp && !followUp.when(answers)) return { status: 'error' };
  const field = coreId ? getQuestion(coreId).field : followUp?.field;
  if (!field) return { status: 'error' };
  const allowUnknown = coreId ? getQuestion(coreId).allowUnknown : false;

  let candidate: unknown;
  if (submission.kind === 'unknown') {
    if (!allowUnknown) return { status: 'error' };
    candidate = { status: 'unknown' };
  } else if (submission.kind === 'range') {
    if (field.kind !== 'number') return { status: 'error' };
    candidate = { status: 'answered', value: rangeValue(submission) };
  } else {
    candidate = { status: 'answered', value: submission.value };
  }

  const parsed = answerSchema(field, allowUnknown).safeParse(candidate);
  if (!parsed.success) {
    return { status: 'invalid', messages: await issueMessages(parsed.error.issues, locale) };
  }
  let answer: Answer = parsed.data;
  let updated: Answers = { ...answers, [step]: answer };
  const typed =
    (submission.kind === 'value' || submission.kind === 'confirmed') &&
    (field.kind === 'short_text' || field.kind === 'long_text')
      ? (submission.value as string)
      : null;

  if (coreId) {
    const blocking = blockingFindings(coreId, answer, updated);
    if (blocking.length > 0) {
      return {
        status: 'rejected',
        findings: blocking.map((finding) => viewFinding(finding, locale)),
      };
    }
  }

  // AI review of typed answers, only with consent and within the limits (D-103, D-120).
  if (coreId && typed !== null && answer.status === 'answered') {
    const ai = await reviewWithAi(
      { supabase, userEmail: user.email, projectId: project.id, answers: updated },
      coreId,
      answer.value as string,
    );
    if (ai) {
      const findings = aiFindings(coreId, ai);
      if (findings.length > 0) {
        return {
          status: 'rejected',
          findings: findings.map((finding) => viewFinding(finding, locale)),
        };
      }
      if (needsConfirmation(ai, answer.value as string)) {
        if (submission.kind !== 'confirmed') return { status: 'confirm', text: ai.confirmation };
        // The confirmed reading comes from the stored review, never from the browser.
        const confirmed = answerSchema(field, allowUnknown).safeParse({
          status: 'answered',
          value: ai.msa,
        });
        if (confirmed.success) {
          answer = confirmed.data;
          updated = { ...answers, [step]: answer };
          const blocking = blockingFindings(coreId, answer, updated);
          if (blocking.length > 0) {
            return {
              status: 'rejected',
              findings: blocking.map((finding) => viewFinding(finding, locale)),
            };
          }
        }
      }
    }
  }

  const provenance = provenanceOf(answer, submission.kind === 'range');
  const { error } = await supabase.from('answers').upsert({
    project_id: project.id,
    question_id: step,
    // What the founder typed, kept as written (CLAUDE.md §3).
    raw_text: typed,
    // Validated JSON by construction: the question bank schema accepted it just above.
    normalized_value: answer as Json,
    ...provenance,
  });
  if (error) {
    await log.error('diagnostic.save_failed', {
      ...errorFields(error),
      stage: 'upsert',
      questionId: step,
    });
    return { status: 'error' };
  }

  const current = await dropInactiveFollowUps(supabase, project.id, updated);

  const notes = [
    ...(coreId ? reviewAnswer(coreId, answer, current) : []),
    ...reviewProject(current).filter(
      (finding) =>
        finding.questionId === step || (coreId !== null && finding.related?.includes(coreId)),
    ),
  ].filter((finding) => finding.severity === 'warn' || finding.severity === 'block');

  revalidatePath(`/${locale}${projectPath(project.id)}`, 'layout');
  const sequenceMode = diagnosticSequence(project.mode, current).includes(step)
    ? project.mode
    : 'full';
  const next = nextStep(sequenceMode, current, step);
  return {
    status: 'saved',
    next: next ? stepPath(project.id, next) : null,
    notes: notes.map((finding) => viewFinding(finding, locale)),
  };
}

// -----------------------------------------------------------------------------------------------
// Project settings
// -----------------------------------------------------------------------------------------------

/** Quick to full (or back). Answers are kept either way. */
export async function switchMode(
  localeInput: Locale,
  projectId: string,
  mode: 'quick' | 'full',
): Promise<void> {
  const locale = localeSchema.parse(localeInput);
  const { supabase } = await requireAccount(locale);
  const { error } = await supabase
    .from('projects')
    .update({ mode: modeSchema.parse(mode) })
    .eq('id', z.uuid().parse(projectId));
  if (error) throw error;
  revalidatePath(`/${locale}${projectPath(projectId)}`, 'layout');
}

export async function deleteProject(localeInput: Locale, projectId: string): Promise<void> {
  const locale = localeSchema.parse(localeInput);
  const { supabase } = await requireAccount(locale);
  const { error } = await supabase.from('projects').delete().eq('id', z.uuid().parse(projectId));
  if (error) throw error;
  revalidatePath(`/${locale}/projects`);
  redirect(`/${locale}/projects`);
}
