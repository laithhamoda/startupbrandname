import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { PdfRenderError } from './errors';
import { findPlaywrightChromium, launchBrowser, resolveLocalExecutable } from './launch';

const directories: string[] = [];
function temporaryDirectory(): string {
  const directory = mkdtempSync(join(tmpdir(), 'sbn-launch-'));
  directories.push(directory);
  return directory;
}
afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

function touch(path: string): string {
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, '');
  return path;
}

describe('findPlaywrightChromium', () => {
  it('returns undefined for a cache directory that does not exist or is empty', () => {
    expect(findPlaywrightChromium(join(temporaryDirectory(), 'missing'))).toBeUndefined();
    expect(findPlaywrightChromium(temporaryDirectory())).toBeUndefined();
  });

  it('prefers the newest headless shell, then the newest full Chromium', () => {
    const cache = temporaryDirectory();
    touch(join(cache, 'chromium-1300', 'chrome-linux64', 'chrome'));
    touch(
      join(
        cache,
        'chromium_headless_shell-1100',
        'chrome-headless-shell-linux64',
        'chrome-headless-shell',
      ),
    );
    const newest = touch(
      join(
        cache,
        'chromium_headless_shell-1200',
        'chrome-headless-shell-linux64',
        'chrome-headless-shell',
      ),
    );
    expect(findPlaywrightChromium(cache)).toBe(newest);
  });

  it('falls back to full Chromium, in either of Playwright layouts', () => {
    const modern = temporaryDirectory();
    const first = touch(join(modern, 'chromium-1200', 'chrome-linux64', 'chrome'));
    touch(join(modern, 'chromium-1100', 'chrome-linux64', 'chrome'));
    expect(findPlaywrightChromium(modern)).toBe(first);

    const older = temporaryDirectory();
    const second = touch(join(older, 'chromium-900', 'chrome-linux', 'chrome'));
    expect(findPlaywrightChromium(older)).toBe(second);
  });

  it('ignores a folder that has no binary and files that are not browsers', () => {
    const cache = temporaryDirectory();
    mkdirSync(join(cache, 'chromium-1200'), { recursive: true });
    touch(join(cache, 'ffmpeg-1011', 'ffmpeg-linux'));
    expect(findPlaywrightChromium(cache)).toBeUndefined();
  });
});

describe('resolveLocalExecutable', () => {
  it('uses PDF_CHROMIUM_PATH when it points to a file', () => {
    const file = touch(join(temporaryDirectory(), 'chrome'));
    expect(resolveLocalExecutable({ env: { PDF_CHROMIUM_PATH: ` ${file} ` } })).toBe(file);
  });

  it('refuses a PDF_CHROMIUM_PATH that does not exist, with a typed error', () => {
    const action = () =>
      resolveLocalExecutable({ env: { PDF_CHROMIUM_PATH: join(temporaryDirectory(), 'nope') } });
    expect(action).toThrow(PdfRenderError);
    expect(action).toThrow(/PDF_CHROMIUM_PATH/);
    try {
      action();
    } catch (error) {
      expect((error as PdfRenderError).code).toBe('browser_unavailable');
    }
  });

  it('falls back to the Playwright cache when the variable is empty or blank', () => {
    const cache = temporaryDirectory();
    const binary = touch(join(cache, 'chromium-1200', 'chrome-linux64', 'chrome'));
    expect(
      resolveLocalExecutable({ env: { PDF_CHROMIUM_PATH: '  ' }, playwrightCacheDirectory: cache }),
    ).toBe(binary);
    expect(resolveLocalExecutable({ env: {}, playwrightCacheDirectory: cache })).toBe(binary);
  });

  it('throws a typed error when there is no browser at all', () => {
    expect(() =>
      resolveLocalExecutable({ env: {}, playwrightCacheDirectory: temporaryDirectory() }),
    ).toThrow(expect.objectContaining({ name: 'PdfRenderError', code: 'browser_unavailable' }));
  });
});

describe('launchBrowser', () => {
  it('rejects with browser_unavailable when no Chromium can be found', async () => {
    await expect(
      launchBrowser({ env: {}, playwrightCacheDirectory: temporaryDirectory() }),
    ).rejects.toMatchObject({ name: 'PdfRenderError', code: 'browser_unavailable' });
  });

  it('rejects with launch_failed when the executable does not start a browser', async () => {
    const script = join(temporaryDirectory(), 'fake-chrome');
    writeFileSync(script, '#!/bin/sh\nexit 1\n');
    chmodSync(script, 0o755);
    const error: unknown = await launchBrowser({ env: { PDF_CHROMIUM_PATH: script } }).catch(
      (caught: unknown) => caught,
    );
    expect(error).toBeInstanceOf(PdfRenderError);
    expect(error).toMatchObject({ code: 'launch_failed' });
    // The message never carries the cause: the cause is kept apart.
    expect((error as PdfRenderError).message).toBe('The PDF browser did not start.');
    expect((error as PdfRenderError).cause).toBeDefined();
  });
});
