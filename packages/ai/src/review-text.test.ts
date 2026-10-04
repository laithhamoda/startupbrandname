import { describe, expect, it } from 'vitest';
import { anthropicClient } from './client';
import { fakeClient, fakeReview } from './fake';
import { inputHash } from './hash';
import {
  needsConfirmation,
  parseReview,
  REVIEW_PROMPT_VERSION,
  REVIEW_SYSTEM,
  reviewUserMessage,
  type ReviewInput,
} from './review-text';

const input: ReviewInput = {
  question: 'ما المشكلة التي تحلّها بالضبط؟',
  rules: ['R8'],
  ideaCheck: false,
  answer: 'المطاعم تعاني بزاف من الأعطال',
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
