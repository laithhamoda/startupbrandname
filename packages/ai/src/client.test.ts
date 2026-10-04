import { APIUserAbortError } from '@anthropic-ai/sdk';
import { describe, expect, it, vi } from 'vitest';
import { anthropicClient, MAX_RETRIES } from './client';
import { deidentify } from './deidentify';
import type { ReviewInput } from './review-text';

// The time budget of a review (D-150): the caller's signal ends the call, its retry and any wait
// the API asks for, and an attempt is retried at most once.

const input: ReviewInput = {
  question: 'ما المشكلة التي تحلّها بالضبط؟',
  rules: [],
  ideaCheck: false,
  answer: deidentify('المطاعم تعاني من الأعطال').text,
};

const overloaded = (headers: Record<string, string>) =>
  new Response(JSON.stringify({ type: 'error', error: { type: 'overloaded_error' } }), {
    status: 529,
    headers: { 'content-type': 'application/json', ...headers },
  });

describe('a review call under a deadline', () => {
  it('gives up when the API never answers', async () => {
    // Like the real fetch: nothing arrives, and the request ends only when it is aborted.
    const fetch = vi.fn<typeof globalThis.fetch>(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('The operation was aborted.', 'AbortError'));
          });
        }),
    );
    const started = performance.now();

    await expect(
      anthropicClient('test-key', { fetch }).reviewText('claude-haiku-4-5-20251001', input, {
        signal: AbortSignal.timeout(50),
      }),
    ).rejects.toBeInstanceOf(APIUserAbortError);
    expect(performance.now() - started).toBeLessThan(2_000);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('does not wait out a long retry-after once the deadline has passed', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(() =>
      Promise.resolve(overloaded({ 'retry-after': '120' })),
    );
    const started = performance.now();

    await expect(
      anthropicClient('test-key', { fetch }).reviewText('claude-haiku-4-5-20251001', input, {
        signal: AbortSignal.timeout(50),
      }),
    ).rejects.toBeInstanceOf(APIUserAbortError);
    expect(performance.now() - started).toBeLessThan(2_000);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('retries an overloaded API once, then reports the failure', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(() =>
      Promise.resolve(overloaded({ 'retry-after-ms': '1' })),
    );

    await expect(
      anthropicClient('test-key', { fetch }).reviewText('claude-haiku-4-5-20251001', input),
    ).rejects.toMatchObject({ status: 529 });
    expect(fetch).toHaveBeenCalledTimes(1 + MAX_RETRIES);
  });
});
