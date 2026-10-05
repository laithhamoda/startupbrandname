import { afterEach, describe, expect, it, vi } from 'vitest';
import { hardenAuthCookie } from '@/lib/supabase/cookies';
import { isHttpsDeployment } from './deployment';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('isHttpsDeployment', () => {
  it('is true on Vercel only', () => {
    expect(isHttpsDeployment({ VERCEL: '1' })).toBe(true);
    expect(isHttpsDeployment({})).toBe(false);
    expect(isHttpsDeployment({ VERCEL: '0' })).toBe(false);
  });

  it('decides whether auth cookies are Secure', () => {
    vi.stubEnv('VERCEL', '1');
    expect(hardenAuthCookie({ path: '/x' })).toMatchObject({ secure: true, httpOnly: true });
    vi.stubEnv('VERCEL', undefined);
    expect(hardenAuthCookie({})).toMatchObject({ secure: false, path: '/' });
  });
});
