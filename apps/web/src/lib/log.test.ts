import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { allowedFields, errorFields, log, type LogFields, REDACTED } from './log';

const requestHeaders = vi.hoisted((): { current: Headers | null } => ({ current: new Headers() }));

vi.mock('next/headers', () => ({
  headers: () =>
    requestHeaders.current
      ? Promise.resolve(requestHeaders.current)
      : Promise.reject(new Error('outside a request')),
}));

function spyOnConsole() {
  return {
    debug: vi.spyOn(console, 'debug').mockImplementation(() => undefined),
    info: vi.spyOn(console, 'info').mockImplementation(() => undefined),
    warn: vi.spyOn(console, 'warn').mockImplementation(() => undefined),
    error: vi.spyOn(console, 'error').mockImplementation(() => undefined),
  };
}

function lineOf(spy: ReturnType<typeof spyOnConsole>['error']): Record<string, unknown> {
  expect(spy).toHaveBeenCalledTimes(1);
  return JSON.parse(String(spy.mock.calls[0]?.[0])) as Record<string, unknown>;
}

let output: ReturnType<typeof spyOnConsole>;

beforeEach(() => {
  requestHeaders.current = new Headers({ 'x-vercel-id': 'fra1::abc12-1790606651375-ce8630578182' });
  vi.stubEnv('LOG_LEVEL', undefined);
  output = spyOnConsole();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('log', () => {
  it('writes one JSON line with the level, the event and the request id', async () => {
    await log.error('diagnostic.save_failed', { stage: 'upsert', code: '42501', status: 403 });

    const line = lineOf(output.error);
    expect(line).toMatchObject({
      level: 'error',
      event: 'diagnostic.save_failed',
      stage: 'upsert',
      code: '42501',
      status: 403,
      requestId: 'fra1::abc12-1790606651375-ce8630578182',
    });
    expect(Date.parse(String(line.time))).not.toBeNaN();
  });

  it('never writes an email, an answer, a prompt or an error message', async () => {
    const leaky = {
      stage: 'upsert',
      email: 'founder@example.com',
      answer: 'صيانة دورية لمكيّفات المطاعم',
      prompt: 'Review this answer',
      message: 'duplicate key (email)=(founder@example.com)',
      rawText: 'x',
    } as LogFields;

    await log.warn('diagnostic.save_refused', leaky);

    const line = lineOf(output.warn);
    expect(Object.keys(line).sort()).toEqual(['event', 'level', 'requestId', 'stage', 'time']);
    expect(JSON.stringify(line)).not.toMatch(/founder|example\.com|صيانة|Review/);
  });

  it('redacts an allowed field whose value is not a short token', async () => {
    await log.error('auth.onboarding_failed', {
      code: 'founder@example.com',
      reason: 'صيانة دورية',
      stage: 'two words',
      digest: 'x'.repeat(201),
      count: Number.NaN,
    });

    expect(lineOf(output.error)).toMatchObject({
      code: REDACTED,
      reason: REDACTED,
      stage: REDACTED,
      digest: REDACTED,
      count: REDACTED,
    });
  });

  it('honours LOG_LEVEL, with info as the default', async () => {
    await log.debug('test.skipped');
    expect(output.debug).not.toHaveBeenCalled();

    vi.stubEnv('LOG_LEVEL', 'warn');
    await log.info('test.skipped');
    expect(output.info).not.toHaveBeenCalled();
    await log.warn('test.written');
    expect(output.warn).toHaveBeenCalledTimes(1);

    vi.stubEnv('LOG_LEVEL', 'debug');
    await log.debug('test.written');
    expect(output.debug).toHaveBeenCalledTimes(1);

    vi.stubEnv('LOG_LEVEL', 'verbose');
    await log.info('test.written');
    expect(output.info).toHaveBeenCalledTimes(1);
  });

  it('logs outside a request, without a request id', async () => {
    requestHeaders.current = null;
    await log.error('request.failed', { digest: '2338785109' });

    const line = lineOf(output.error);
    expect(line.digest).toBe('2338785109');
    expect(line).not.toHaveProperty('requestId');
  });

  it('prefers a request id passed in', async () => {
    await log.error('request.failed', { requestId: 'fra1::given' });
    expect(lineOf(output.error).requestId).toBe('fra1::given');
  });

  it('replaces an event name that does not follow the convention', async () => {
    await log.info('Founder founder@example.com.signed_in');
    expect(lineOf(output.info).event).toBe('log.invalid_event');
  });
});

describe('allowedFields', () => {
  it('keeps opaque identifiers and route templates', () => {
    expect(
      allowedFields({
        projectId: '6f1c1f1e-7d4b-4c55-9a51-0f6f5d2b9e10',
        questionId: 'G4.1',
        route: '/[locale]/(app)/projects/[id]/q/[step]',
      }),
    ).toEqual({
      projectId: '6f1c1f1e-7d4b-4c55-9a51-0f6f5d2b9e10',
      questionId: 'G4.1',
      route: '/[locale]/(app)/projects/[id]/q/[step]',
    });
  });
});

describe('errorFields', () => {
  it('reads the code, class and status, never the message', () => {
    const error = Object.assign(new Error('Key (email)=(founder@example.com) exists'), {
      name: 'PostgrestError',
      code: '23505',
      status: 409,
    });
    expect(errorFields(error)).toEqual({ code: '23505', errorName: 'PostgrestError', status: 409 });
  });

  it.each([null, undefined, 'text', 42])('returns nothing for %j', (value) => {
    expect(errorFields(value)).toEqual({});
  });
});
