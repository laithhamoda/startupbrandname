import { describe, expect, it } from 'vitest';
import { siteOriginFor } from './site-origin';

describe('siteOriginFor (D-340)', () => {
  it('is the site address in production, whatever the request says', () => {
    expect(siteOriginFor({ production: true, host: 'evil.example', protocol: 'http' })).toBe(
      'https://startupbrandname.com',
    );
    expect(siteOriginFor({ production: true, host: null, protocol: null })).toBe(
      'https://startupbrandname.com',
    );
  });

  it('reads the request elsewhere, so each preview deployment comes back to itself', () => {
    expect(
      siteOriginFor({
        production: false,
        host: 'startupbrandname-git-x.vercel.app',
        protocol: 'https',
      }),
    ).toBe('https://startupbrandname-git-x.vercel.app');
    expect(siteOriginFor({ production: false, host: 'localhost:3000', protocol: null })).toBe(
      'http://localhost:3000',
    );
  });

  it('refuses to guess without a Host outside production', () => {
    expect(() => siteOriginFor({ production: false, host: null, protocol: 'https' })).toThrow(
      'Host header',
    );
  });
});
