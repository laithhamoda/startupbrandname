import { redirect } from 'next/navigation';
import { describe, expect, it } from 'vitest';
import { callAction } from './call-action';

const FAILED = { status: 'error' } as const;

describe('callAction', () => {
  it('returns what the action returns', async () => {
    expect(await callAction(() => Promise.resolve({ status: 'done' }), FAILED)).toEqual({
      status: 'done',
    });
  });

  it('turns a dropped connection into the failure result', async () => {
    expect(await callAction(() => Promise.reject(new TypeError('Failed to fetch')), FAILED)).toBe(
      FAILED,
    );
  });

  it('turns an error thrown on the server into the failure result too', async () => {
    // In production the client receives such an error with only its digest.
    const thrown = Object.assign(new Error('An error occurred in the Server Components render.'), {
      digest: '2417253870',
    });

    expect(await callAction(() => Promise.reject(thrown), FAILED)).toBe(FAILED);
  });

  it('lets a redirect through', async () => {
    let signal = new Error('not thrown');
    try {
      redirect('/ar/login');
    } catch (error) {
      // redirect() signals with an Error that carries a NEXT_REDIRECT digest.
      signal = error as Error;
    }

    await expect(callAction(() => Promise.reject(signal), FAILED)).rejects.toBe(signal);
  });
});
