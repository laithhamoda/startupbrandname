import { describe, expect, it } from 'vitest';
import { countVisits, withoutQuery } from './analytics';

describe('analytics events', () => {
  it('drop the query string and fragment from the page URL', () => {
    expect(
      withoutQuery({
        type: 'pageview',
        url: 'https://startupbrandname.com/ar/login?error=google#x',
      }),
    ).toEqual({ type: 'pageview', url: 'https://startupbrandname.com/ar/login' });
  });

  it('keep a clean URL as it is', () => {
    expect(withoutQuery({ type: 'pageview', url: 'https://startupbrandname.com/en' }).url).toBe(
      'https://startupbrandname.com/en',
    );
  });
});

describe('visit counting', () => {
  it('runs on the Vercel production deployment only', () => {
    expect(countVisits({ VERCEL: '1', VERCEL_ENV: 'production' })).toBe(true);
    expect(countVisits({ VERCEL: '1', VERCEL_ENV: 'preview' })).toBe(false);
    // A local build that imitates production (the Lighthouse job) loads no Vercel script.
    expect(countVisits({ VERCEL_ENV: 'production' })).toBe(false);
    expect(countVisits({})).toBe(false);
  });
});
