import { z } from 'zod';

/**
 * Prices per million tokens in USD, read from `settings` (CLAUDE.md rule 10). Stored with the
 * page they were read from and the date, so a stale price is visible.
 */
export const priceSchema = z.object({
  input: z.number().nonnegative(),
  output: z.number().nonnegative(),
  cache_write: z.number().nonnegative(),
  cache_read: z.number().nonnegative(),
  source_url: z.url(),
  checked_at: z.iso.date(),
});

export type Price = z.infer<typeof priceSchema>;

export interface Usage {
  inputTokens: number;
  outputTokens: number;
  cacheWriteTokens: number;
  cacheReadTokens: number;
}

/** The cost of one call in USD, rounded to a millionth of a dollar. */
export function costUsd(usage: Usage, price: Price): number {
  const cost =
    (usage.inputTokens * price.input +
      usage.outputTokens * price.output +
      usage.cacheWriteTokens * price.cache_write +
      usage.cacheReadTokens * price.cache_read) /
    1_000_000;
  return Math.round(cost * 1_000_000) / 1_000_000;
}
