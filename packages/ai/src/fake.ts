import type { AiClient } from './client';
import type { ReviewOutput } from './review-text';

/**
 * A deterministic stand-in for the model, for tests and CI (AI_PROVIDER=fake): no network, no
 * cost. It recognises a few dialect words, rewrites them from a small table, and treats a B1
 * answer of at least four words as a coherent idea. It never flags a rule.
 */
const DIALECT: Readonly<Record<string, string>> = {
  بزاف: 'كثيرًا',
  راني: 'أنا',
  ديال: 'الخاص بـ',
  واش: 'هل',
  كتير: 'كثيرًا',
  بدي: 'أريد',
  هلق: 'الآن',
};

const ARABIC = /[؀-ۿ]/;
const LATIN = /[A-Za-z]/;

export function fakeReview(answer: string, ideaCheck: boolean): ReviewOutput {
  const words = answer.split(/\s+/).filter(Boolean);
  const dialect = words.some((word) => word in DIALECT);
  const mixed = ARABIC.test(answer) && LATIN.test(answer);
  const language: ReviewOutput['language'] = !ARABIC.test(answer)
    ? 'english'
    : dialect
      ? 'dialect'
      : mixed
        ? 'mixed'
        : 'msa';
  const msa = dialect ? words.map((word) => DIALECT[word] ?? word).join(' ') : answer;
  return {
    language,
    msa,
    confirmation: dialect || mixed ? `فهمت أن ${msa}` : '',
    violations: [],
    coherent: ideaCheck ? words.length >= 4 : null,
  };
}

export function fakeClient(): AiClient {
  return {
    reviewText(_model, input) {
      return Promise.resolve({
        input: fakeReview(input.answer, input.ideaCheck),
        usage: { inputTokens: 0, outputTokens: 0, cacheWriteTokens: 0, cacheReadTokens: 0 },
      });
    },
  };
}
