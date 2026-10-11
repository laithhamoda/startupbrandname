import type { Browser } from 'puppeteer-core';
import { launchBrowser, type LaunchOptions } from './launch';

let shared: Promise<Browser> | undefined;

/**
 * One browser for the life of the process, so a warm function skips the 1 to 3 seconds of a start.
 * `launched` is true for the caller that started it (a cold invocation), false when it was reused.
 * A browser that died, or one that failed to start, is replaced on the next call.
 */
export async function getSharedBrowser(
  options?: LaunchOptions,
): Promise<{ browser: Browser; launched: boolean }> {
  if (shared) {
    const existing = await shared.catch(() => undefined);
    if (existing?.connected) return { browser: existing, launched: false };
  }
  const starting = launchBrowser(options);
  shared = starting;
  try {
    return { browser: await starting, launched: true };
  } catch (error) {
    if (shared === starting) shared = undefined;
    throw error;
  }
}

/** Closes the shared browser (a test or a graceful shutdown). */
export async function closeSharedBrowser(): Promise<void> {
  const existing = await shared?.catch(() => undefined);
  shared = undefined;
  await existing?.close().catch(() => undefined);
}
