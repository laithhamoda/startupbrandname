'use server';

import {
  type Answer,
  type Answers,
  activeFollowUps,
  type Field,
  type Finding,
  type QuestionId,
  diagnosticSequence,
  FOLLOW_UPS,
  isCurrencyCode,
  type Language,
  type Mode,
  modeSchema,
  nextStep,
  numberLimits,
  rangeValue,
  resolveStep,
  reviewAnswer,
  sequenceModeFor,
  type StepId,
  stepNotes,
  VALUE_ISSUES,
  valueSchema,
} from '@sbn/question-bank';
import { needsConfirmation } from '@sbn/ai';
import { getTranslations } from 'next-intl/server';
import { revalidatePath } from 'next/cache';
import { redirect, unstable_rethrow } from 'next/navigation';
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
//
// Server Action convention, for every action the UI calls:
// - It returns a typed result for each outcome a person can meet, failures included (the
//   database refused or could not be reached, the project is gone). The failure is logged with
//   lib/log.ts and the form shows it next to the button, keeping what the person entered.
// - It throws only for invariant violations: input no page of ours can send, such as an unknown
//   locale. instrumentation.ts logs those with their digest. A form that calls the action
//   through callAction shows them as its failure message, like a dropped connection; any other
//   caller gets the error page (error.tsx), whose reference number is that digest.
// - redirect() and notFound() are signals, not errors: a catch that covers them calls
//   unstable_rethrow(error) first, on the server and in the component that awaits the action.
// - The form calls it through useActionState and callAction (lib/call-action.ts, which turns a
//   dropped connection into the failure result): while it runs, the button is disabled and says
//   what is happening, and a failure is announced (FormError, role="alert").

const localeSchema = z.enum(routing.locales);

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
  /**
   * Not saved: the answer does not fit the question. Each error names the part of the answer it
   * is about by its path ("items.1.amount", '' for the whole answer), in the page language, so
   * the editor shows it under that box (UX-3).
   */
  | { status: 'invalid'; errors: { path: string; message: string }[] }
  /** Not saved yet: confirm the AI's reading of a dialect answer first (D-119). */
  | { status: 'confirm'; text: string }
  /**
   * Not saved. `gone`: the project was deleted; `stale`: this follow-up no longer applies. Trying
   * again cannot help either, so the editor says why and links to where the founder can go on.
   * `failed`: anything else, such as the database being unreachable; the editor keeps the draft
   * so the founder can try again.
   */
  | { status: 'error'; reason: 'failed' | 'stale' | 'gone' };

const FAILED = { status: 'error', reason: 'failed' } as const satisfies SaveResult;
const STALE = { status: 'error', reason: 'stale' } as const satisfies SaveResult;
const GONE = { status: 'error', reason: 'gone' } as const satisfies SaveResult;

/** How far a save got, for the log line when it fails. */
interface SaveTrace {
  stage: 'account' | 'load' | 'review' | 'upsert';
}

/**
 * The errors of a value that does not fit its field, each with its path and a message that
 * states the limit it broke (UX-3, ARCH-M2). Limits are written as plain Western digits: a
 * grouped "1,000" could itself be read two ways (UX-2).
 */
async function fieldErrors(
  field: Field,
  issues: readonly z.core.$ZodIssue[],
  language: Language,
): Promise<{ path: string; message: string }[]> {
  const t = await getTranslations({ locale: language, namespace: 'diagnostic.errors' });
  const messageOf = (issue: z.core.$ZodIssue, path: string): string => {
    if (issue.code === 'custom' && (VALUE_ISSUES as readonly string[]).includes(issue.message)) {
      return t(issue.message as (typeof VALUE_ISSUES)[number]);
    }
    if (issue.code === 'invalid_type' && issue.expected === 'int') return t('wholeNumber');
    if (issue.code === 'too_small' && issue.origin === 'array') {
      return t('minItems', { count: Number(issue.minimum) });
    }
    if (issue.code === 'too_big' && issue.origin === 'array') {
      return t('maxItems', { count: String(issue.maximum) });
    }
    if ((issue.code === 'too_small' || issue.code === 'too_big') && issue.origin === 'number') {
      // A share of 0% (G4): the lower bound itself is refused.
      if (issue.code === 'too_small' && !issue.inclusive) {
        return t('aboveMin', { min: String(issue.minimum) });
      }
      const limits = numberLimits(field, path);
      if (limits) return t('outOfRange', { min: String(limits.min), max: String(limits.max) });
    }
    if (issue.code === 'too_big' && issue.origin === 'string') {
      return t('tooLong', { max: String(issue.maximum) });
    }
    if (issue.code === 'invalid_format') return t('url');
    return t('required');
  };
  return issues.map((issue) => {
    const path = issue.path.map(String).join('.');
    return { path, message: messageOf(issue, path) };
  });
}

/** Findings that stop the save: a rule asks for another answer or a clarification (SPEC §2). */
function blockingFindings(questionId: QuestionId, answer: Answer, answers: Answers): Finding[] {
  return reviewAnswer(questionId, answer, answers).filter(
    (finding) => finding.severity === 'reject' || finding.severity === 'ask',
  );
}

/**
 * Deletes every stored follow-up the answers no longer call for (D-116), read or not: loading
 * already ignores them (parseAnswers). Best effort: the answer itself is saved by then, and the
 * next save retries, so a failure is logged instead of failing the save.
 */
async function dropInactiveFollowUps(
  supabase: Awaited<ReturnType<typeof requireAccount>>['supabase'],
  projectId: string,
  answers: Answers,
): Promise<Answers> {
  const active = new Set(activeFollowUps(answers).map((followUp) => followUp.id));
  const inactive = FOLLOW_UPS.map((followUp) => followUp.id).filter((id) => !active.has(id));
  const inactiveIds = new Set<string>(inactive);
  const current = Object.fromEntries(
    Object.entries(answers).filter(([id]) => !inactiveIds.has(id)),
  );
  if (inactive.length === 0) return current;
  try {
    const { error } = await supabase
      .from('answers')
      .delete()
      .eq('project_id', projectId)
      .in('question_id', inactive);
    if (error) {
      await log.warn('diagnostic.follow_up_cleanup_failed', { ...errorFields(error), projectId });
    }
  } catch (error) {
    unstable_rethrow(error);
    await log.warn('diagnostic.follow_up_cleanup_failed', { ...errorFields(error), projectId });
  }
  return current;
}

/**
 * Saves one step's answer, or says why not. Failures are returned, never thrown (see the
 * convention at the top of this file), so the editor keeps what the founder typed.
 */
export async function saveAnswer(input: SaveInput): Promise<SaveResult> {
  const parsedInput = saveSchema.safeParse(input);
  if (!parsedInput.success) return FAILED;
  const step = stepFromSlug(parsedInput.data.step.replace('.', '-'));
  if (!step) return FAILED;

  const trace: SaveTrace = { stage: 'account' };
  try {
    return await save({ ...parsedInput.data, step }, trace);
  } catch (error) {
    // Redirects (a session that ended) and Next.js's own signals must pass through.
    unstable_rethrow(error);
    await log.error('diagnostic.save_failed', {
      ...errorFields(error),
      stage: trace.stage,
      questionId: step,
    });
    return FAILED;
  }
}

async function save(
  {
    locale,
    projectId,
    step,
    submission,
  }: Omit<z.output<typeof saveSchema>, 'step'> & { step: StepId },
  trace: SaveTrace,
): Promise<SaveResult> {
  const { supabase, user } = await requireAccount(locale);
  trace.stage = 'load';
  const loaded = await loadProject(supabase, projectId);
  // Deleted, perhaps in another tab.
  if (!loaded) return GONE;
  const { project, answers } = loaded;

  const resolved = resolveStep(step, answers);
  // An earlier answer changed (perhaps in another tab) and this follow-up no longer applies.
  if (resolved?.status !== 'active') return STALE;
  const { field, allowUnknown } = resolved.step;
  const coreId = resolved.step.question?.id ?? null;

  trace.stage = 'review';
  let answer: Answer;
  if (submission.kind === 'unknown') {
    if (!allowUnknown) return FAILED;
    answer = { status: 'unknown' };
  } else {
    let value: unknown;
    if (submission.kind === 'range') {
      if (field.kind !== 'number') return FAILED;
      value = rangeValue(submission, field.integer);
    } else {
      value = submission.value;
    }
    // The value on its own, so each issue keeps its code: inside answerSchema's union with
    // «لا أعرف», zod reports every issue as invalid_union, read as "complete the fields" (UX-1).
    const parsed = valueSchema(field).safeParse(value);
    if (!parsed.success) {
      return { status: 'invalid', errors: await fieldErrors(field, parsed.error.issues, locale) };
    }
    answer = { status: 'answered', value: parsed.data };
  }
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

  // AI review of typed answers, only with consent and within the limits (D-103, D-120). It comes
  // back in the founder's own words, so no placeholder reaches the confirmation text or the saved
  // answer (D-149).
  if (coreId && typed !== null && answer.status === 'answered') {
    const ai = await reviewWithAi(
      {
        supabase,
        identity: { email: user.email, names: user.names },
        projectId: project.id,
        answers: updated,
      },
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
        const confirmed = valueSchema(field).safeParse(ai.msa);
        if (confirmed.success) {
          answer = { status: 'answered', value: confirmed.data };
          updated = { ...answers, [step]: answer };
          const blocking = blockingFindings(coreId, answer, updated);
          if (blocking.length > 0) {
            return {
              status: 'rejected',
              findings: blocking.map((finding) => viewFinding(finding, locale)),
            };
          }
        } else {
          // The model's reading does not fit the question (too long, for instance). The founder
          // confirmed their own answer, which already passed every check above: save it as typed.
          await log.warn('diagnostic.msa_unusable', { questionId: coreId, reason: 'schema' });
        }
      }
    }
  }

  trace.stage = 'upsert';
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
    return FAILED;
  }

  const current = await dropInactiveFollowUps(supabase, project.id, updated);

  revalidatePath(`/${locale}${projectPath(project.id)}`, 'layout');
  const next = nextStep(sequenceModeFor(project.mode, current, step), current, step);
  return {
    status: 'saved',
    next: next ? stepPath(project.id, next) : null,
    // The same warnings the step page shows when the founder comes back (stepNotes).
    notes: stepNotes(step, current).map((finding) => viewFinding(finding, locale)),
  };
}

// -----------------------------------------------------------------------------------------------
// Project settings
// -----------------------------------------------------------------------------------------------

/**
 * A project settings form (convention at the top of this file). Success re-renders the page
 * (`done`) or leaves it; `error` means nothing changed and the form says so.
 */
export type SettingsResult = { status: 'idle' } | { status: 'done' } | { status: 'error' };

async function settingsFailed(
  event: 'diagnostic.mode_switch_failed' | 'diagnostic.delete_failed',
  error: unknown,
  projectId: string,
): Promise<SettingsResult> {
  await log.error(event, { ...errorFields(error), projectId });
  return { status: 'error' };
}

/** Quick to full (or back). Answers are kept either way. */
export async function switchMode(
  localeInput: Locale,
  projectId: string,
  mode: Mode,
): Promise<SettingsResult> {
  const locale = localeSchema.parse(localeInput);
  const id = z.uuid().parse(projectId);
  const target = modeSchema.parse(mode);
  try {
    const { supabase } = await requireAccount(locale);
    const { error } = await supabase.from('projects').update({ mode: target }).eq('id', id);
    if (error) return await settingsFailed('diagnostic.mode_switch_failed', error, id);
  } catch (error) {
    unstable_rethrow(error);
    return settingsFailed('diagnostic.mode_switch_failed', error, id);
  }
  revalidatePath(`/${locale}${projectPath(id)}`, 'layout');
  return { status: 'done' };
}

export async function deleteProject(
  localeInput: Locale,
  projectId: string,
): Promise<SettingsResult> {
  const locale = localeSchema.parse(localeInput);
  const id = z.uuid().parse(projectId);
  try {
    const { supabase } = await requireAccount(locale);
    const { error } = await supabase.from('projects').delete().eq('id', id);
    if (error) return await settingsFailed('diagnostic.delete_failed', error, id);
  } catch (error) {
    unstable_rethrow(error);
    return settingsFailed('diagnostic.delete_failed', error, id);
  }
  revalidatePath(`/${locale}/projects`);
  redirect(`/${locale}/projects`);
}
