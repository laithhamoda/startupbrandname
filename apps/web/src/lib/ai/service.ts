import 'server-only';
import {
  AI_RULES,
  type AiClient,
  type AiRule,
  anthropicClient,
  deidentify,
  fakeClient,
  type Identity,
  inputHash,
  parseReview,
  priceSchema,
  restoreReview,
  REVIEW_PROMPT_VERSION,
  type ReviewInput,
  type ReviewOutput,
  storedReview,
  type ToolCallResult,
} from '@sbn/ai';
import { type Answers, getQuestion, type QuestionId } from '@sbn/question-bank';
import { z } from 'zod';
import { getServerEnv } from '@/env/server';
import { errorFields, log } from '@/lib/log';
import type { Json } from '@/lib/supabase/database.types';
import type { SupabaseServerClient } from '@/lib/supabase/server';
import { crossborderConsentState } from './consent';
import { activeProvider } from './provider';

const TOOL = 'review_text';

/**
 * The time one save may spend on AI review, the B1 check included, shared by every call it makes
 * (each retried at most once, client.ts). When it runs out the answer gets the fixed checks only
 * (D-150).
 */
export const AI_BUDGET_MS = 8_000;

/** How long a review that failed is not tried again for the same input (D-151). */
export const RETRY_AFTER_FAILURE_MS = 10 * 60 * 1000;
const MAX_FAILURES_KEPT = 1000;

/** Why a save got no AI review, for the log only: founders are not told (OBS-2, D-152). */
type SkipReason =
  | 'off'
  | 'no_consent'
  | 'consent_outdated'
  | 'no_settings'
  | 'no_idea'
  | 'idea_unclear'
  | 'unusable_output'
  | 'recent_failure'
  | 'budget_spent'
  | 'timeout'
  | Exclude<Reservation['reason'], 'ok'>;

type Stage = 'consent' | 'settings' | 'cache' | 'reserve' | 'model' | 'record';

/**
 * The ordinary reasons, logged at debug level: AI is off, there is no current consent, or the
 * idea is not clear yet (D-072).
 */
const EXPECTED: ReadonlySet<SkipReason> = new Set([
  'off',
  'no_consent',
  'consent_outdated',
  'no_idea',
  'idea_unclear',
]);

async function skipped(reason: SkipReason, questionId: QuestionId): Promise<null> {
  const write = EXPECTED.has(reason) ? log.debug : reason === 'timeout' ? log.warn : log.info;
  await write('ai.skipped', { reason, questionId });
  return null;
}

async function failed(stage: Stage, error: unknown, questionId: QuestionId): Promise<null> {
  await log.error('ai.error', { ...errorFields(error), stage, questionId });
  return null;
}

/** The configured client, or null when AI is off (provider.ts). */
function configuredClient(): AiClient | null {
  const provider = activeProvider();
  if (provider === 'fake') return fakeClient();
  const key = getServerEnv().ANTHROPIC_API_KEY;
  return provider === 'anthropic' && key ? anthropicClient(key) : null;
}

interface AiSettings {
  model: string;
}

/**
 * The model from `settings` (CLAUDE.md rule 10). Prices are keyed by model ID, so a model
 * switched without its price turns AI off instead of being paid for and then refused by
 * record_ai_run(), which computes the cost from that price (D-122, D-146).
 */
async function readSettings(supabase: SupabaseServerClient): Promise<AiSettings | null> {
  const { data, error } = await supabase
    .from('settings')
    .select('key, value')
    .in('key', ['ai.model.fast', 'ai.prices']);
  if (error) throw error;
  const values = new Map(data.map((row) => [row.key, row.value]));
  const model = z.string().min(1).safeParse(values.get('ai.model.fast'));
  if (!model.success) return null;
  const prices = z.record(z.string(), z.unknown()).safeParse(values.get('ai.prices'));
  const price = priceSchema.safeParse(prices.success ? prices.data[model.data] : undefined);
  return price.success ? { model: model.data } : null;
}

/** What reserve_ai_run() answers (D-146). */
const reservationSchema = z.discriminatedUnion('reason', [
  z.object({ reason: z.literal('ok'), reservation: z.uuid() }),
  z.object({ reason: z.enum(['user_limit', 'global_cap', 'disabled']), reservation: z.null() }),
]);
type Reservation = z.infer<typeof reservationSchema>;

/**
 * Inputs whose review failed lately, per server instance (D-151): during an outage neither the
 * same answer nor the B1 check behind every later one waits out the budget again.
 */
const recentFailures = new Map<string, number>();

function failedRecently(key: string): boolean {
  const until = recentFailures.get(key);
  if (until === undefined) return false;
  if (until > Date.now()) return true;
  recentFailures.delete(key);
  return false;
}

function rememberFailure(key: string): void {
  recentFailures.delete(key);
  recentFailures.set(key, Date.now() + RETRY_AFTER_FAILURE_MS);
  // The oldest entries go first, so the map stays small.
  for (const oldest of recentFailures.keys()) {
    if (recentFailures.size <= MAX_FAILURES_KEPT) break;
    recentFailures.delete(oldest);
  }
}

export interface AiContext {
  supabase: SupabaseServerClient;
  /** The account's email and the names from its sign-in profile, removed before any call (rule 5). */
  identity: Identity;
  projectId: string;
  answers: Answers;
}

/** True once the save's budget has run out; read afresh at each call. */
function outOfTime(signal: AbortSignal): boolean {
  return signal.aborted;
}

interface Run {
  context: AiContext;
  client: AiClient;
  settings: AiSettings;
  /** The budget of the whole save (AI_BUDGET_MS). */
  signal: AbortSignal;
  trace: { stage: Stage; questionId: QuestionId };
}

/**
 * One review, reused when the same de-identified input was reviewed before (rule 4), in the
 * founder's own words: no placeholder reaches the caller (restoreReview, D-149).
 */
async function review(
  run: Run,
  questionId: QuestionId,
  text: string,
): Promise<ReviewOutput | null> {
  const { context, client, settings, signal, trace } = run;
  trace.questionId = questionId;
  const question = getQuestion(questionId);
  const hidden = deidentify(text, context.identity);
  const input: ReviewInput = {
    question: question.label.ar,
    rules: question.rules.filter((rule): rule is AiRule =>
      (AI_RULES as readonly string[]).includes(rule),
    ),
    ideaCheck: questionId === 'B1',
    answer: hidden.text,
  };
  const hash = inputHash({
    tool: TOOL,
    version: REVIEW_PROMPT_VERSION,
    model: settings.model,
    input,
  });

  trace.stage = 'cache';
  // A failed lookup throws: without it, a paid repeat could follow (OBS-2).
  const { data: cached, error } = await context.supabase
    .from('tool_runs')
    .select('output')
    .eq('project_id', context.projectId)
    .eq('tool_id', TOOL)
    .eq('input_hash', hash)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (cached) {
    const reused = parseReview(cached.output, input);
    // An unusable output is the result for this input until the input, the prompt version or
    // the model changes (D-151).
    return reused
      ? restoreReview(reused, text, hidden.originals)
      : skipped('unusable_output', questionId);
  }
  const failureKey = `${context.projectId}:${hash}`;
  if (failedRecently(failureKey)) return skipped('recent_failure', questionId);
  if (outOfTime(signal)) return skipped('budget_spent', questionId);

  // Counts against the user's daily calls and checks the global spend cap (D-120, D-146).
  trace.stage = 'reserve';
  const reserved = await context.supabase.rpc('reserve_ai_run');
  if (reserved.error) throw reserved.error;
  const reservation = reservationSchema.parse(reserved.data);
  if (reservation.reason !== 'ok') return skipped(reservation.reason, questionId);

  trace.stage = 'model';
  let result: ToolCallResult;
  try {
    result = await client.reviewText(settings.model, input, { signal });
  } catch (thrown) {
    rememberFailure(failureKey);
    return outOfTime(signal) ? skipped('timeout', questionId) : failed('model', thrown, questionId);
  }
  const output = parseReview(result.input, input);

  // Recorded even when unusable, so its cost counts towards the daily cap (D-124) and the same
  // input is not paid for again (D-151). The cost is computed by the database (D-146), and the
  // stored output stays de-identified and keeps a wording only for a real rewrite (PRIV-5).
  trace.stage = 'record';
  const recorded = await context.supabase.rpc('record_ai_run', {
    p_reservation: reservation.reservation,
    p_project_id: context.projectId,
    p_tool_id: TOOL,
    p_input_hash: hash,
    p_output: (output ? storedReview(output, input) : { unusable: true }) as unknown as Json,
    p_model: settings.model,
    p_prompt_version: REVIEW_PROMPT_VERSION,
    p_tokens_in: result.usage.inputTokens,
    p_tokens_out: result.usage.outputTokens,
    p_cache_write_tokens: result.usage.cacheWriteTokens,
    p_cache_read_tokens: result.usage.cacheReadTokens,
  });
  if (recorded.error) await failed('record', recorded.error, questionId);
  return output
    ? restoreReview(output, text, hidden.originals)
    : skipped('unusable_output', questionId);
}

/**
 * Reviews a typed answer with the model, or returns null when AI must not or cannot run: no
 * provider or key, no current cross-border consent (D-103, D-147), limits reached (D-120), the
 * time budget spent (D-150), a recent failure or an unusable output for this input (D-151), any
 * database error, or, for any question but B1, no accepted idea yet (D-072). Null means "use the
 * fixed checks only"; every such case is logged with its reason (D-152). The review comes back
 * in the founder's own words, never with a placeholder (D-149).
 */
export async function reviewWithAi(
  context: AiContext,
  questionId: QuestionId,
  text: string,
): Promise<ReviewOutput | null> {
  const client = configuredClient();
  if (!client) return skipped('off', questionId);
  const trace: Run['trace'] = { stage: 'consent', questionId };
  try {
    const consent = await crossborderConsentState(context.supabase);
    if (consent !== 'current') {
      return await skipped(consent === 'outdated' ? 'consent_outdated' : 'no_consent', questionId);
    }
    trace.stage = 'settings';
    const settings = await readSettings(context.supabase);
    if (!settings) return await skipped('no_settings', questionId);

    const run: Run = {
      context,
      client,
      settings,
      signal: AbortSignal.timeout(AI_BUDGET_MS),
      trace,
    };
    if (questionId !== 'B1') {
      const idea = context.answers.B1;
      if (idea?.status !== 'answered' || typeof idea.value !== 'string') {
        return await skipped('no_idea', questionId);
      }
      const ideaReview = await review(run, 'B1', idea.value);
      // A null review has logged its reason already.
      if (!ideaReview) return null;
      if (ideaReview.coherent !== true) return await skipped('idea_unclear', questionId);
    }
    return await review(run, questionId, text);
  } catch (error) {
    // Any failure falls back to the fixed checks; the founder is never blocked by the model.
    return failed(trace.stage, error, trace.questionId);
  }
}
