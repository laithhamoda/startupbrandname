import { describe, expect, it } from 'vitest';
import { localizedAlternates } from './alternates';

describe('localizedAlternates', () => {
  it('points the home page x-default at the language-detecting root', () => {
    expect(localizedAlternates('ar', '')).toEqual({
      canonical: '/ar',
      languages: { ar: '/ar', en: '/en', 'x-default': '/' },
    });
  });

  it('makes each language version canonical to itself', () => {
    expect(localizedAlternates('en', '/privacy')).toEqual({
      canonical: '/en/privacy',
      languages: { ar: '/ar/privacy', en: '/en/privacy', 'x-default': '/privacy' },
    });
  });
});
