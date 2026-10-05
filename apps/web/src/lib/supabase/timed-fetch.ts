/**
 * The longest one Supabase request may take from a page, a Server Action or a route handler
 * (REL-4, D-168). A typed answer's save also waits for the AI review (8 s, D-150) and must end
 * within the step page's 30 seconds.
 */
export const SERVER_FETCH_TIMEOUT_MS = 8_000;

/**
 * The longest one Supabase request may take from the proxy, which runs before every page a
 * signed-in visitor opens, public pages included.
 */
export const PROXY_FETCH_TIMEOUT_MS = 3_000;

/**
 * A fetch that gives up after `timeoutMs`, or as soon as the caller's own signal aborts (REL-4).
 * Without it a Supabase call that never answers holds the page or the save until the platform
 * stops the function. `base` is the fetch to call, the global one (as Next.js patches it) when
 * left out.
 */
export function timedFetch(timeoutMs: number, base?: typeof fetch): typeof fetch {
  return (input, init) => {
    const timeout = AbortSignal.timeout(timeoutMs);
    const caller = init?.signal ?? (input instanceof Request ? input.signal : null);
    return (base ?? fetch)(input, {
      ...init,
      signal: caller ? AbortSignal.any([caller, timeout]) : timeout,
    });
  };
}
