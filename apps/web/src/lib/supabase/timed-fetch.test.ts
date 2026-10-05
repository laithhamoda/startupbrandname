import { describe, expect, it, vi } from 'vitest';
import { PROXY_FETCH_TIMEOUT_MS, SERVER_FETCH_TIMEOUT_MS, timedFetch } from './timed-fetch';

/**
 * A fetch to a server that never answers: it never resolves on its own and, like the real fetch,
 * rejects with the signal's reason once its signal aborts.
 */
function neverAnswers() {
  return vi.fn(
    (_input: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        const signal = init?.signal;
        signal?.addEventListener(
          'abort',
          () => {
            reject(signal.reason as Error);
          },
          { once: true },
        );
      }),
  );
}

/** What `promise` rejects with, or null when it resolves. */
function rejection(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => null,
    (error: unknown) => error,
  );
}

describe('timedFetch', () => {
  it('gives up on a server that never answers once the timeout passes', async () => {
    const base = neverAnswers();

    const error = await rejection(timedFetch(20, base)('https://db.example/rest/v1/projects'));

    expect(error).toBeInstanceOf(DOMException);
    expect((error as DOMException).name).toBe('TimeoutError');
    expect(base).toHaveBeenCalledOnce();
  });

  it('gives up as soon as the caller aborts, before the timeout', async () => {
    const base = neverAnswers();
    const caller = new AbortController();
    const started = Date.now();

    const pending = rejection(
      timedFetch(SERVER_FETCH_TIMEOUT_MS, base)('https://db.example/auth/v1/token', {
        signal: caller.signal,
      }),
    );
    caller.abort();
    const error = await pending;

    expect((error as DOMException).name).toBe('AbortError');
    expect(Date.now() - started).toBeLessThan(SERVER_FETCH_TIMEOUT_MS);
  });

  it('also follows the signal of a Request passed as the input', async () => {
    const base = neverAnswers();
    const caller = new AbortController();

    const pending = rejection(
      timedFetch(
        SERVER_FETCH_TIMEOUT_MS,
        base,
      )(new Request('https://db.example/rest/v1/answers', { signal: caller.signal })),
    );
    caller.abort();

    expect(((await pending) as DOMException).name).toBe('AbortError');
  });

  it('passes the request through unchanged apart from its signal', async () => {
    const response = new Response('[]', { status: 200 });
    const base = vi.fn<typeof fetch>(() => Promise.resolve(response));
    const headers = { apikey: 'sb_publishable_test' };

    const result = await timedFetch(PROXY_FETCH_TIMEOUT_MS, base)('https://db.example/x', {
      method: 'POST',
      headers,
      body: '{}',
    });

    expect(result).toBe(response);
    const [input, init] = base.mock.calls[0] ?? [];
    expect(input).toBe('https://db.example/x');
    expect(init).toMatchObject({ method: 'POST', headers, body: '{}' });
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    expect(init?.signal?.aborted).toBe(false);
  });

  it('gives the proxy a shorter limit than pages and actions', () => {
    expect(PROXY_FETCH_TIMEOUT_MS).toBe(3_000);
    expect(SERVER_FETCH_TIMEOUT_MS).toBe(8_000);
  });
});
