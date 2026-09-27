import 'server-only';
import {
  AI_RULES,
  type AiClient,
  type AiRule,
  anthropicClient,
  costUsd,
  deidentify,
  fakeClient,
  inputHash,
  parseReview,
  type Price,
  priceSchema,
  REVIEW_PROMPT_VERSION,
  type ReviewInput,
  type ReviewOutput,
} from '@sbn/ai';
import { type Answers, getQuestion, type QuestionId } from '@sbn/question-bank';
import { z } from 'zod';
import { getServerEnv } from '@/env/server';
import type { Json } from '@/lib/supabase/database.types';
import type { SupabaseServerClient } from '@/lib/supabase/server';

const TOOL = 'review_text';

interface AiSettings {
  model: string;
  price: Price;
}

/** The configured provider, or null when AI is off or has no key (D-123). */
function configuredClient(): AiClient | null {
  const env = getServerEnv();
  if (env.AI_PROVIDER === 'off') return null;
  // The stand-in never answers real founders.
  if (env.AI_PROVIDER === 'fake') return env.VERCEL_ENV === 'production' ? null : fakeClient();
  return env.ANTHROPIC_API_KEY ? anthropicClient(env.ANTHROPIC_API_KEY) : null;
}

/** The model and its price from `settings` (CLAUDE.md rule 10); null if either is missing. */
async function readSettings(supabase: SupabaseServerClient): Promise<AiSettings | null> {
  const { data: modelRow } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'ai.model.fast')
    .maybeSingle();
  const model = z.string().min(1).safeParse(modelRow?.value);
  if (!model.success) return null;
  const { data: priceRow } = await supabase
    .from('settings')
    .select('value')
    .eq('key', `ai.price.${model.data}`)
    .maybeSingle();
  const price = priceSchema.safeParse(priceRow?.value);
  return price.success ? { model: model.data, price: price.data } : null;
}

export interface AiContext {
  supabase: SupabaseServerClient;
  /** Removed from the text before it leaves (rule 5). */
  userEmail: string | null;
  projectId: string;
  answers: Answers;
}

/** One review, reused when the same de-identified input was reviewed before (rule 4). */
async function review(
  context: AiContext,
  client: AiClient,
  settings: AiSettings,
  questionId: QuestionId,
  text: string,
): Promise<ReviewOutput | null> {
  const question = getQuestion(questionId);
  const input: ReviewInput = {
    question: question.label.ar,
    rules: question.rules.filter((rule): rule is AiRule =>
      (AI_RULES as readonly string[]).includes(rule),
    ),
    ideaCheck: questionId === 'B1',
    answer: deidentify(text, { email: context.userEmail }),
  };
  const hash = inputHash({
    tool: TOOL,
    version: REVIEW_PROMPT_VERSION,
    model: settings.model,
    input,
  });

  const { data: cached } = await context.supabase
    .from('tool_runs')
    .select('output')
    .eq('project_id', context.projectId)
    .eq('tool_id', TOOL)
    .eq('input_hash', hash)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (cached) {
    const reused = parseReview(cached.output, input);
    if (reused) return reused;
  }

  // Counts against the user's daily calls and checks the global spend cap (D-120).
  const { data: allowed } = await context.supabase.rpc('reserve_ai_call');
  if (!allowed) return null;

  try {
    const result = await client.reviewText(settings.model, input);
    const output = parseReview(result.input, input);
    // Recorded even when unusable, so its cost counts towards the daily cap (D-124). An unusable
    // output is never reused: parseReview rejects it on the next lookup.
    const { error } = await context.supabase.rpc('record_tool_run', {
      p_project_id: context.projectId,
      p_tool_id: TOOL,
      p_input_hash: hash,
      p_output: (output ?? { unusable: true }) as unknown as Json,
      p_model: settings.model,
      p_prompt_version: REVIEW_PROMPT_VERSION,
      p_tokens_in: result.usage.inputTokens,
      p_tokens_out: result.usage.outputTokens,
      p_cache_write_tokens: result.usage.cacheWriteTokens,
      p_cache_read_tokens: result.usage.cacheReadTokens,
      p_cost_usd: costUsd(result.usage, settings.price),
    });
    if (error) console.error('ai.record_tool_run failed', { code: error.code });
    return output;
  } catch (error) {
    // Any failure falls back to the fixed checks; the founder is never blocked by the model.
    console.error('ai.review_text failed', {
      name: error instanceof Error ? error.name : 'unknown',
    });
    return null;
  }
}

/**
 * Reviews a typed answer with the model, or returns null when AI must not or cannot run: no
 * provider or key, no cross-border consent (D-103), limits reached (D-120), or, for any question
 * but B1, no accepted idea yet (D-072). A null result means "use the fixed checks only".
 */
export async function reviewWithAi(
  context: AiContext,
  questionId: QuestionId,
  text: string,
): Promise<ReviewOutput | null> {
  const client = configuredClient();
  if (!client) return null;
  const { data: consent } = await context.supabase.rpc('has_crossborder_consent');
  if (!consent) return null;
  const settings = await readSettings(context.supabase);
  if (!settings) return null;

  if (questionId !== 'B1') {
    const idea = context.answers.B1;
    if (idea?.status !== 'answered' || typeof idea.value !== 'string') return null;
    const ideaReview = await review(context, client, settings, 'B1', idea.value);
    if (ideaReview?.coherent !== true) return null;
  }
  return review(context, client, settings, questionId, text);
}
