import { describe, expect, it } from 'vitest';
import { costUsd, priceSchema } from './cost';

// Claude Haiku 4.5, from https://platform.claude.com/docs/en/about-claude/pricing (2026-09-28).
const HAIKU = priceSchema.parse({
  input: 1,
  output: 5,
  cache_write: 1.25,
  cache_read: 0.1,
  source_url: 'https://platform.claude.com/docs/en/about-claude/pricing',
  checked_at: '2026-09-28',
});

describe('costUsd (CLAUDE.md rule 10)', () => {
  it('prices each kind of token at its own rate', () => {
    expect(
      costUsd(
        { inputTokens: 1_000_000, outputTokens: 0, cacheWriteTokens: 0, cacheReadTokens: 0 },
        HAIKU,
      ),
    ).toBe(1);
    expect(
      costUsd(
        { inputTokens: 0, outputTokens: 1_000_000, cacheWriteTokens: 0, cacheReadTokens: 0 },
        HAIKU,
      ),
    ).toBe(5);
    expect(
      costUsd(
        {
          inputTokens: 0,
          outputTokens: 0,
          cacheWriteTokens: 1_000_000,
          cacheReadTokens: 1_000_000,
        },
        HAIKU,
      ),
    ).toBe(1.35);
  });

  it('rounds a typical answer review to the millionth of a dollar', () => {
    expect(
      costUsd(
        { inputTokens: 1234, outputTokens: 321, cacheWriteTokens: 0, cacheReadTokens: 0 },
        HAIKU,
      ),
    ).toBe(0.002839);
  });

  it('refuses a price without its source and date', () => {
    expect(
      priceSchema.safeParse({ input: 1, output: 5, cache_write: 1.25, cache_read: 0.1 }).success,
    ).toBe(false);
  });
});
