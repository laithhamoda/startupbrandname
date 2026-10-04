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

  it('replace the project ID in the path, so no project can be told apart (PRIV-14)', () => {
    const url = (path: string) =>
      withoutQuery({ type: 'pageview', url: `https://x.com${path}` }).url;
    expect(url('/ar/projects/3f2b8c1e-9a4d-4e6f-8b7a-1c2d3e4f5a6b/q/B1?step=2')).toBe(
      'https://x.com/ar/projects/:id/q/B1',
    );
    expect(url('/en/projects/3F2B8C1E-9A4D-4E6F-8B7A-1C2D3E4F5A6B')).toBe(
      'https://x.com/en/projects/:id',
    );
    // Only a whole segment is an ID.
    expect(url('/ar/glossary/3f2b8c1e-9a4d-4e6f-8b7a-1c2d3e4f5a6bx')).toBe(
      'https://x.com/ar/glossary/3f2b8c1e-9a4d-4e6f-8b7a-1c2d3e4f5a6bx',
    );
    expect(url('/ar/projects/new')).toBe('https://x.com/ar/projects/new');
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
