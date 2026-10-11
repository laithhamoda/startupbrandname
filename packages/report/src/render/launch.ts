import { existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, join } from 'node:path';
import puppeteer, { type Browser } from 'puppeteer-core';
import { PdfRenderError } from './errors';

/**
 * Starts the headless Chromium that makes the PDF (D-235, D-239). No Next.js import: the same
 * module runs in a Vercel function, in a test and later in a render worker.
 *
 * - On Vercel (the VERCEL variable is set) it loads @sparticuz/chromium with a dynamic import, so
 *   tests and laptops never load its 60 MB of binaries. It ships the browser for Amazon Linux 2023,
 *   the runtime of the Node.js 24 functions, and unpacks it into /tmp on a cold start.
 * - Everywhere else it needs PDF_CHROMIUM_PATH, the path of a Chromium or chrome-headless-shell.
 *   For local convenience only (never relied on in CI), it falls back to the newest Chromium that
 *   Playwright installed in ~/.cache/ms-playwright, so `pnpm exec playwright install chromium` is
 *   enough on a laptop. PDF_CHROMIUM_NO_SANDBOX=1 starts it without the sandbox, for a container
 *   that forbids user namespaces (the pinned Playwright image of CI, D-240).
 */

export interface LaunchOptions {
  /** Defaults to process.env. */
  env?: Readonly<Record<string, string | undefined>>;
  /** Where Playwright keeps its browsers. Defaults to ~/.cache/ms-playwright. */
  playwrightCacheDirectory?: string;
}

/**
 * Flags of @sparticuz/chromium that a renderer of static data: documents does not need and that
 * switch off protections (the same-origin policy and the block on insecure content). The CSP tag
 * and the request filter remain the main defence, but the browser keeps its own as well.
 */
export const UNNEEDED_INSECURE_FLAGS: readonly string[] = [
  '--disable-web-security',
  '--allow-running-insecure-content',
];

/** Playwright's layouts, newest browser first: the headless shell is lighter, then full Chromium. */
const PLAYWRIGHT_BINARIES: readonly { directory: RegExp; binary: string[] }[] = [
  {
    directory: /^chromium_headless_shell-\d+$/,
    binary: ['chrome-headless-shell-linux64', 'chrome-headless-shell'],
  },
  { directory: /^chromium-\d+$/, binary: ['chrome-linux64', 'chrome'] },
  { directory: /^chromium-\d+$/, binary: ['chrome-linux', 'chrome'] },
];

function revision(directory: string): number {
  // Every name here ends in its revision, as the patterns above require.
  return Number(directory.slice(directory.lastIndexOf('-') + 1));
}

/** The Playwright Chromium on this machine, or undefined. */
export function findPlaywrightChromium(cacheDirectory: string): string | undefined {
  let entries: string[];
  try {
    entries = readdirSync(cacheDirectory);
  } catch {
    return undefined;
  }
  for (const { directory, binary } of PLAYWRIGHT_BINARIES) {
    const candidates = entries
      .filter((entry) => directory.test(entry))
      .sort((a, b) => revision(b) - revision(a));
    for (const candidate of candidates) {
      const path = join(cacheDirectory, candidate, ...binary);
      if (existsSync(path)) return path;
    }
  }
  return undefined;
}

/** The executable for a laptop or CI: PDF_CHROMIUM_PATH first, then Playwright's own. */
export function resolveLocalExecutable(options: LaunchOptions = {}): string {
  const env = options.env ?? process.env;
  const configured = env.PDF_CHROMIUM_PATH?.trim();
  if (configured) {
    if (!existsSync(configured)) {
      throw new PdfRenderError(
        'browser_unavailable',
        'PDF_CHROMIUM_PATH does not point to a file.',
      );
    }
    return configured;
  }
  const found = findPlaywrightChromium(
    options.playwrightCacheDirectory ?? join(homedir(), '.cache', 'ms-playwright'),
  );
  if (!found) {
    throw new PdfRenderError(
      'browser_unavailable',
      'No Chromium found: set PDF_CHROMIUM_PATH to a Chromium or chrome-headless-shell executable.',
    );
  }
  return found;
}

/** A headless shell binary only speaks the old headless mode; a full Chromium the new one. */
function headlessModeFor(executable: string): 'shell' | true {
  return /headless[-_]shell/.test(basename(executable)) ? 'shell' : true;
}

/**
 * Chromium cannot use its sandbox as root, nor as a normal user in a container that forbids user
 * namespaces, which is how the pinned Playwright image of CI runs (user 1001). So the sandbox is
 * dropped for root and for PDF_CHROMIUM_NO_SANDBOX=1 (Playwright's own launcher drops it by
 * default; Puppeteer's does not). Only on the local path: on Vercel the flags of
 * @sparticuz/chromium already carry it.
 */
function noSandbox(env: Readonly<Record<string, string | undefined>>): boolean {
  if (env.PDF_CHROMIUM_NO_SANDBOX === '1') return true;
  return typeof process.getuid === 'function' && process.getuid() === 0;
}

async function launchOnVercel(): Promise<Browser> {
  const { default: chromium } = await import('@sparticuz/chromium');
  // The report uses no WebGL: this only adds --disable-webgl. The package still unpacks its 6 MB
  // software renderer into /tmp on a cold start, whatever the mode.
  chromium.setGraphicsMode = false;
  const executablePath = await chromium.executablePath();
  const args = chromium.args.filter((flag) => !UNNEEDED_INSECURE_FLAGS.includes(flag));
  return puppeteer.launch({
    args: await puppeteer.defaultArgs({ args, headless: 'shell' }),
    executablePath,
    headless: 'shell',
  });
}

async function launchLocal(options: LaunchOptions): Promise<Browser> {
  const env = options.env ?? process.env;
  const executablePath = resolveLocalExecutable(options);
  const headless = headlessModeFor(executablePath);
  return puppeteer.launch({
    executablePath,
    headless,
    args: await puppeteer.defaultArgs({
      args: noSandbox(env) ? ['--no-sandbox'] : [],
      headless,
    }),
  });
}

/** Starts a browser. The caller closes it. Throws a PdfRenderError. */
export async function launchBrowser(options: LaunchOptions = {}): Promise<Browser> {
  const env = options.env ?? process.env;
  try {
    return env.VERCEL ? await launchOnVercel() : await launchLocal(options);
  } catch (error) {
    if (error instanceof PdfRenderError) throw error;
    throw new PdfRenderError('launch_failed', 'The PDF browser did not start.', { cause: error });
  }
}
