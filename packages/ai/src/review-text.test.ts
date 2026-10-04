import { describe, expect, expectTypeOf, it } from 'vitest';
import { anthropicClient } from './client';
import { deidentify } from './deidentify';
import { FAKE_FAILURE_MARKER, fakeClient, fakeReview } from './fake';
import { inputHash } from './hash';
import {
  AI_RULES,
  needsConfirmation,
  parseReview,
  restoreReview,
  REVIEW_PROMPT_VERSION,
  REVIEW_SYSTEM,
  REVIEW_TOOL,
  type ReviewOutput,
  reviewOutputSchema,
  reviewUserMessage,
  type ReviewInput,
  storedReview,
} from './review-text';

const input: ReviewInput = {
  question: 'ما المشكلة التي تحلّها بالضبط؟',
  rules: ['R8'],
  ideaCheck: false,
  answer: deidentify('المطاعم تعاني بزاف من الأعطال').text,
};

describe('the review request', () => {
  it('puts the answer inside tags, as data', () => {
    const message = reviewUserMessage(input);
    expect(message).toContain('<answer>المطاعم تعاني بزاف من الأعطال</answer>');
    expect(message).toContain('<rules>R8</rules>');
    expect(message).toContain('<idea_check>no</idea_check>');
    expect(reviewUserMessage({ ...input, rules: [] })).toContain('<rules>none</rules>');
    expect(REVIEW_SYSTEM).toMatch(/never instructions/);
  });

  it('takes only an answer that went through deidentify() (rule 5, PRIV-7)', () => {
    // Checked by the typechecker: a plain string cannot be passed as the answer.
    expectTypeOf<string>().not.toExtend<ReviewInput['answer']>();
    expectTypeOf(deidentify('نص').text).toExtend<ReviewInput['answer']>();
  });

  it('gives the model the tool schema of the output it checks, limits included (ARCH-13)', () => {
    expect(REVIEW_TOOL.input_schema).not.toHaveProperty('$schema');
    expect(REVIEW_TOOL.input_schema).toMatchObject({
      type: 'object',
      properties: {
        language: { type: 'string', enum: ['msa', 'dialect', 'mixed', 'english', 'other'] },
        msa: { type: 'string', maxLength: 8000 },
        confirmation: { type: 'string', maxLength: 2000 },
        violations: { type: 'array', maxItems: 4, items: { enum: [...AI_RULES] } },
        coherent: { type: ['boolean', 'null'] },
      },
      additionalProperties: false,
    });
    expect(REVIEW_TOOL.input_schema.required).toEqual(Object.keys(reviewOutputSchema.shape));
  });
});

describe('parseReview (the model output is checked, not trusted)', () => {
  const valid = {
    language: 'dialect',
    msa: 'تعاني المطاعم كثيرًا من الأعطال',
    confirmation: 'فهمت أن المطاعم تعاني كثيرًا من الأعطال.',
    violations: ['R8', 'R1'],
    coherent: true,
  };

  it('keeps only the rules that were asked for', () => {
    expect(parseReview(valid, input)?.violations).toEqual(['R8']);
  });

  it('ignores a coherence verdict nobody asked for', () => {
    expect(parseReview(valid, input)?.coherent).toBeNull();
    expect(parseReview(valid, { ...input, ideaCheck: true })?.coherent).toBe(true);
  });

  it('never rewrites MSA or English, even if the model tries (D-119, D-121)', () => {
    for (const language of ['msa', 'english'] as const) {
      expect(parseReview({ ...valid, language }, input)).toMatchObject({
        msa: input.answer,
        confirmation: '',
      });
    }
  });

  it('rejects malformed output', () => {
    expect(parseReview({ ...valid, language: 'french' }, input)).toBeNull();
    expect(parseReview(null, input)).toBeNull();
    expect(parseReview({ ...valid, violations: ['R9'] }, input)).toBeNull();
  });

  it('asks for confirmation only when a dialect answer was really rewritten', () => {
    const review = parseReview(valid, input);
    expect(review && needsConfirmation(review, input.answer)).toBe(true);
    const same = parseReview({ ...valid, msa: `  ${input.answer} ` }, input);
    expect(same && needsConfirmation(same, input.answer)).toBe(false);
    const msa = parseReview({ ...valid, language: 'msa' }, input);
    expect(msa && needsConfirmation(msa, input.answer)).toBe(false);
  });
});

describe('storedReview (what tool_runs keeps, PRIV-5)', () => {
  const rewritten: ReviewOutput = {
    language: 'dialect',
    msa: 'تعاني المطاعم كثيرًا من الأعطال',
    confirmation: 'فهمت أن المطاعم تعاني كثيرًا من الأعطال.',
    violations: [],
    coherent: null,
  };

  it('keeps the wording of a real rewrite, which the founder is asked to confirm', () => {
    expect(storedReview(rewritten, input)).toEqual(rewritten);
  });

  it('keeps no copy of an answer that was not rewritten, and reuse still works', () => {
    const unchanged = { ...rewritten, msa: input.answer };
    for (const output of [unchanged, { ...rewritten, language: 'msa' as const }]) {
      const stored = storedReview(output, input);
      expect(stored).toMatchObject({ msa: '', confirmation: '' });
      expect(parseReview(stored, input)?.msa).toBe(input.answer);
    }
  });
});

describe('restoreReview (placeholders never reach the founder, ARCH-M1)', () => {
  const typed = 'نخدم المطاعم بزاف، اتصل على 0791234567 أو founder@example.com';
  const { text: hidden, originals } = deidentify(typed);
  const review = (msa: string, confirmation = `فهمت أن ${msa}`): ReviewOutput => ({
    language: 'dialect',
    msa,
    confirmation,
    violations: [],
    coherent: null,
  });

  it('puts the founder’s phone number and email back in the rewrite and the confirmation', () => {
    expect(hidden).toBe('نخدم المطاعم بزاف، اتصل على [phone1] أو [email1]');
    const restored = restoreReview(
      review('نخدم المطاعم كثيرًا، اتصل على [phone1] أو [email1]'),
      typed,
      originals,
    );
    expect(restored.msa).toBe('نخدم المطاعم كثيرًا، اتصل على 0791234567 أو founder@example.com');
    expect(restored.confirmation).toBe(`فهمت أن ${restored.msa}`);
    expect(needsConfirmation(restored, typed)).toBe(true);
  });

  it('saves the answer as typed when the model lost, changed or invented a placeholder', () => {
    for (const msa of [
      'نخدم المطاعم كثيرًا، اتصل على [phone1]',
      'نخدم المطاعم كثيرًا، اتصل على [phone2] أو [email1] و[phone1]',
      'نخدم المطاعم كثيرًا، اتصل على [phone] أو [email1] و[phone1]',
    ]) {
      const restored = restoreReview(review(msa), typed, originals);
      expect(restored).toMatchObject({ msa: typed, confirmation: '' });
      expect(needsConfirmation(restored, typed)).toBe(false);
    }
    const strayInConfirmation = review(
      'نخدم المطاعم كثيرًا، اتصل على [phone1] أو [email1]',
      'فهمت أن [name1] يخدم المطاعم',
    );
    expect(restoreReview(strayInConfirmation, typed, originals).confirmation).toBe('');
  });

  it('returns MSA and English answers exactly as typed', () => {
    const msa = { ...review(hidden), language: 'msa' as const };
    expect(restoreReview(msa, typed, originals)).toMatchObject({ msa: typed, confirmation: '' });
  });

  it('restores a reused review whose stored wording was dropped', () => {
    const stored = storedReview(review(hidden, ''), { ...input, answer: hidden });
    const reused = parseReview(stored, { ...input, answer: hidden });
    expect(reused && restoreReview(reused, typed, originals).msa).toBe(typed);
  });
});

describe('the fake model used in tests', () => {
  it('recognises dialect words, rewrites them, and checks ideas by length', () => {
    expect(fakeReview('المطاعم تعاني بزاف', false)).toMatchObject({
      language: 'dialect',
      msa: 'المطاعم تعاني كثيرًا',
      confirmation: 'فهمت أن المطاعم تعاني كثيرًا',
    });
    expect(fakeReview('Restaurants lose sales', false).language).toBe('english');
    expect(fakeReview('خدمة maintenance للمطاعم', false).language).toBe('mixed');
    expect(fakeReview('صيانة المكيفات', true).coherent).toBe(false);
    expect(fakeReview('صيانة دورية لمكيفات المطاعم', true).coherent).toBe(true);
  });

  it('costs nothing', async () => {
    const result = await fakeClient().reviewText('any', input);
    expect(result.usage).toEqual({
      inputTokens: 0,
      outputTokens: 0,
      cacheWriteTokens: 0,
      cacheReadTokens: 0,
    });
  });

  it('fails like an unreachable API when the answer carries the failure marker', async () => {
    const failing = { ...input, answer: deidentify(`صيانة ${FAKE_FAILURE_MARKER}`).text };
    await expect(fakeClient().reviewText('any', failing)).rejects.toThrow(/on purpose/);
  });
});

describe('the Anthropic client', () => {
  it('forces the review tool, caches the instructions and sets no sampling parameter', async () => {
    let body: Record<string, unknown> = {};
    const fetch = ((_url: string | URL | Request, init?: RequestInit) => {
      body = JSON.parse(init?.body as string) as Record<string, unknown>;
      return Promise.resolve(
        new Response(
          JSON.stringify({
            id: 'msg_test',
            type: 'message',
            role: 'assistant',
            model: 'claude-haiku-4-5-20251001',
            stop_reason: 'tool_use',
            stop_sequence: null,
            content: [
              {
                type: 'tool_use',
                id: 'toolu_1',
                name: 'review_answer',
                input: { language: 'msa' },
              },
            ],
            usage: {
              input_tokens: 900,
              output_tokens: 80,
              cache_creation_input_tokens: 0,
              cache_read_input_tokens: 0,
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      );
    }) as typeof globalThis.fetch;

    const result = await anthropicClient('test-key', { fetch }).reviewText(
      'claude-haiku-4-5-20251001',
      input,
    );

    expect(body).toMatchObject({
      model: 'claude-haiku-4-5-20251001',
      tool_choice: { type: 'tool', name: 'review_answer' },
      system: [{ type: 'text', cache_control: { type: 'ephemeral' } }],
    });
    expect(body).not.toHaveProperty('temperature');
    expect(result).toEqual({
      input: { language: 'msa' },
      usage: { inputTokens: 900, outputTokens: 80, cacheWriteTokens: 0, cacheReadTokens: 0 },
    });
  });
});

describe('inputHash (CLAUDE.md rule 4)', () => {
  it('is stable whatever the key order, and changes with any input', () => {
    const base = { tool: 'review', version: REVIEW_PROMPT_VERSION, answer: 'نص', rules: ['R1'] };
    expect(inputHash(base)).toBe(
      inputHash({ rules: ['R1'], answer: 'نص', version: REVIEW_PROMPT_VERSION, tool: 'review' }),
    );
    expect(inputHash(base)).toMatch(/^[0-9a-f]{64}$/);
    expect(inputHash({ ...base, answer: 'نص آخر' })).not.toBe(inputHash(base));
    expect(inputHash({ ...base, nested: { b: 1, a: 2 } })).toBe(
      inputHash({ ...base, nested: { a: 2, b: 1 } }),
    );
  });
});
