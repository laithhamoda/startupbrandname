import { beforeEach, describe, expect, it, vi } from 'vitest';

const launchBrowser = vi.hoisted(() => vi.fn());
vi.mock('./launch', () => ({ launchBrowser }));

const { closeSharedBrowser, getSharedBrowser } = await import('./shared');

interface FakeBrowser {
  connected: boolean;
  close: ReturnType<typeof vi.fn>;
}

function fakeBrowser(connected = true): FakeBrowser {
  return { connected, close: vi.fn().mockResolvedValue(undefined) };
}

describe('getSharedBrowser', () => {
  beforeEach(async () => {
    await closeSharedBrowser();
    launchBrowser.mockReset();
  });

  it('starts one browser and hands the same one to the next caller', async () => {
    const browser = fakeBrowser();
    launchBrowser.mockResolvedValue(browser);

    const first = await getSharedBrowser();
    const second = await getSharedBrowser();

    expect(first).toEqual({ browser, launched: true });
    expect(second).toEqual({ browser, launched: false });
    expect(launchBrowser).toHaveBeenCalledTimes(1);
  });

  it('starts a single browser for two concurrent first calls', async () => {
    const browser = fakeBrowser();
    launchBrowser.mockResolvedValue(browser);

    const [a, b] = await Promise.all([getSharedBrowser(), getSharedBrowser()]);

    expect(launchBrowser).toHaveBeenCalledTimes(1);
    expect(a.browser).toBe(browser);
    expect(b.browser).toBe(browser);
    // Only the caller that started it sees a cold start.
    expect([a.launched, b.launched].filter(Boolean)).toHaveLength(1);
  });

  it('replaces a browser that is no longer connected', async () => {
    const dead = fakeBrowser();
    const fresh = fakeBrowser();
    launchBrowser.mockResolvedValueOnce(dead).mockResolvedValueOnce(fresh);
    await getSharedBrowser();
    dead.connected = false;

    const next = await getSharedBrowser();

    expect(next).toEqual({ browser: fresh, launched: true });
    expect(launchBrowser).toHaveBeenCalledTimes(2);
  });

  it('forgets a launch that failed and tries again on the next call', async () => {
    const failure = new Error('no browser');
    const browser = fakeBrowser();
    launchBrowser.mockRejectedValueOnce(failure).mockResolvedValueOnce(browser);

    await expect(getSharedBrowser()).rejects.toBe(failure);
    await expect(getSharedBrowser()).resolves.toEqual({ browser, launched: true });
    expect(launchBrowser).toHaveBeenCalledTimes(2);
  });

  it('passes the launch options on', async () => {
    launchBrowser.mockResolvedValue(fakeBrowser());
    const options = { env: { PDF_CHROMIUM_PATH: '/x' } };
    await getSharedBrowser(options);
    expect(launchBrowser).toHaveBeenCalledWith(options);
  });
});

describe('closeSharedBrowser', () => {
  beforeEach(async () => {
    await closeSharedBrowser();
    launchBrowser.mockReset();
  });

  it('closes the browser and lets the next call start a new one', async () => {
    const first = fakeBrowser();
    const second = fakeBrowser();
    launchBrowser.mockResolvedValueOnce(first).mockResolvedValueOnce(second);
    await getSharedBrowser();

    await closeSharedBrowser();

    expect(first.close).toHaveBeenCalledTimes(1);
    await expect(getSharedBrowser()).resolves.toEqual({ browser: second, launched: true });
  });

  it('does nothing when no browser was started, and survives a close that fails', async () => {
    await expect(closeSharedBrowser()).resolves.toBeUndefined();

    const browser = fakeBrowser();
    browser.close.mockRejectedValue(new Error('already gone'));
    launchBrowser.mockResolvedValue(browser);
    await getSharedBrowser();
    await expect(closeSharedBrowser()).resolves.toBeUndefined();
  });
});
