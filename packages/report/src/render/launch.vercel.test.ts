import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const launch = vi.hoisted(() => vi.fn());
const defaultArgs = vi.hoisted(() => vi.fn());
const chromium = vi.hoisted(
  (): { args: string[]; setGraphicsMode: boolean; executablePath: ReturnType<typeof vi.fn> } => ({
    args: [
      '--single-process',
      '--disable-web-security',
      '--no-sandbox',
      '--allow-running-insecure-content',
    ],
    setGraphicsMode: true,
    executablePath: vi.fn(),
  }),
);

vi.mock('puppeteer-core', () => ({ default: { launch, defaultArgs } }));
vi.mock('@sparticuz/chromium', () => ({ default: chromium }));

const { launchBrowser } = await import('./launch');
const { PdfRenderError } = await import('./errors');

describe('launchBrowser on Vercel', () => {
  beforeEach(() => {
    launch.mockReset();
    defaultArgs.mockReset();
    chromium.executablePath.mockReset();
    chromium.setGraphicsMode = true;
    defaultArgs.mockResolvedValue(['--default', '--single-process']);
    chromium.executablePath.mockResolvedValue('/tmp/chromium');
  });

  it('loads @sparticuz/chromium and starts its headless shell', async () => {
    const browser = { close: vi.fn() };
    launch.mockResolvedValue(browser);

    await expect(launchBrowser({ env: { VERCEL: '1' } })).resolves.toBe(browser);

    expect(chromium.setGraphicsMode).toBe(false);
    // The two flags that switch off the same-origin policy and the insecure-content block are
    // dropped; the sandbox flag the runtime needs stays.
    expect(defaultArgs).toHaveBeenCalledWith({
      args: ['--single-process', '--no-sandbox'],
      headless: 'shell',
    });
    expect(launch).toHaveBeenCalledWith({
      args: ['--default', '--single-process'],
      executablePath: '/tmp/chromium',
      headless: 'shell',
    });
  });

  it('ignores PDF_CHROMIUM_PATH on Vercel', async () => {
    launch.mockResolvedValue({});
    await launchBrowser({ env: { VERCEL: '1', PDF_CHROMIUM_PATH: '/elsewhere/chrome' } });
    expect(launch).toHaveBeenCalledWith(
      expect.objectContaining({ executablePath: '/tmp/chromium' }),
    );
  });

  it('turns any failure into launch_failed and keeps the cause apart', async () => {
    chromium.executablePath.mockRejectedValue(new Error('cannot unpack brotli'));
    const error: unknown = await launchBrowser({ env: { VERCEL: '1' } }).catch(
      (caught: unknown) => caught,
    );
    expect(error).toBeInstanceOf(PdfRenderError);
    expect(error).toMatchObject({
      code: 'launch_failed',
      message: 'The PDF browser did not start.',
    });
    expect((error as Error).cause).toEqual(new Error('cannot unpack brotli'));
  });
});

describe('launchBrowser off Vercel', () => {
  it('drops the sandbox for PDF_CHROMIUM_NO_SANDBOX=1 and only then', async () => {
    defaultArgs.mockResolvedValue([]);
    launch.mockResolvedValue({});
    const directory = mkdtempSync(join(tmpdir(), 'sbn-launch-sandbox-'));
    try {
      const full = join(directory, 'chrome');
      writeFileSync(full, '');
      await launchBrowser({ env: { PDF_CHROMIUM_PATH: full, PDF_CHROMIUM_NO_SANDBOX: '1' } });
      expect(defaultArgs).toHaveBeenLastCalledWith({ args: ['--no-sandbox'], headless: true });

      const root = typeof process.getuid === 'function' && process.getuid() === 0;
      await launchBrowser({ env: { PDF_CHROMIUM_PATH: full, PDF_CHROMIUM_NO_SANDBOX: '0' } });
      expect(defaultArgs).toHaveBeenLastCalledWith({
        args: root ? ['--no-sandbox'] : [],
        headless: true,
      });
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('starts the executable it was given, headless shell by name, with the sandbox rules', async () => {
    defaultArgs.mockResolvedValue(['--default']);
    launch.mockResolvedValue({});
    const directory = mkdtempSync(join(tmpdir(), 'sbn-launch-local-'));
    try {
      const shell = join(directory, 'chrome-headless-shell');
      const full = join(directory, 'chrome');
      writeFileSync(shell, '');
      writeFileSync(full, '');

      await launchBrowser({ env: { PDF_CHROMIUM_PATH: shell } });
      expect(launch).toHaveBeenLastCalledWith({
        executablePath: shell,
        headless: 'shell',
        args: ['--default'],
      });

      await launchBrowser({ env: { PDF_CHROMIUM_PATH: full } });
      expect(launch).toHaveBeenLastCalledWith({
        executablePath: full,
        headless: true,
        args: ['--default'],
      });
      const root = typeof process.getuid === 'function' && process.getuid() === 0;
      expect(defaultArgs).toHaveBeenLastCalledWith({
        args: root ? ['--no-sandbox'] : [],
        headless: true,
      });
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
