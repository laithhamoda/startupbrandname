import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { launchBrowser, resolveLocalExecutable } from './launch';

// The defaults read process.env and the home directory: these tests stub both.
const directories: string[] = [];
function temporaryDirectory(): string {
  const directory = mkdtempSync(join(tmpdir(), 'sbn-launch-defaults-'));
  directories.push(directory);
  return directory;
}
afterEach(() => {
  vi.unstubAllEnvs();
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

describe('the defaults of the launcher', () => {
  it('reads PDF_CHROMIUM_PATH from the process environment', () => {
    const directory = temporaryDirectory();
    const file = join(directory, 'chrome');
    writeFileSync(file, '');
    vi.stubEnv('PDF_CHROMIUM_PATH', file);
    expect(resolveLocalExecutable()).toBe(file);
  });

  it('looks for the Playwright Chromium in ~/.cache/ms-playwright', () => {
    const home = temporaryDirectory();
    const binary = join(
      home,
      '.cache',
      'ms-playwright',
      'chromium-1200',
      'chrome-linux64',
      'chrome',
    );
    mkdirSync(join(binary, '..'), { recursive: true });
    writeFileSync(binary, '');
    vi.stubEnv('PDF_CHROMIUM_PATH', '');
    vi.stubEnv('HOME', home);
    expect(resolveLocalExecutable()).toBe(binary);
  });

  it('launchBrowser() fails with a typed error when the machine has no browser', async () => {
    vi.stubEnv('VERCEL', '');
    vi.stubEnv('PDF_CHROMIUM_PATH', '');
    vi.stubEnv('HOME', temporaryDirectory());
    await expect(launchBrowser()).rejects.toMatchObject({
      name: 'PdfRenderError',
      code: 'browser_unavailable',
    });
  });
});
