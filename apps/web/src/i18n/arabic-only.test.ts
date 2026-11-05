import { describe, expect, it } from 'vitest';
import { arabicRedirect, hasEnglishVersion } from './arabic-only';

describe('arabicRedirect', () => {
  it('sends an English page to its Arabic page', () => {
    expect(arabicRedirect('/en')).toBe('/ar');
    expect(arabicRedirect('/en/pricing')).toBe('/ar/pricing');
    expect(arabicRedirect('/en/projects/abc/report')).toBe('/ar/projects/abc/report');
  });

  it('keeps the English privacy policy and terms', () => {
    expect(arabicRedirect('/en/privacy')).toBeNull();
    expect(arabicRedirect('/en/terms')).toBeNull();
  });

  it('leaves Arabic and other paths alone', () => {
    expect(arabicRedirect('/ar/pricing')).toBeNull();
    expect(arabicRedirect('/english')).toBeNull();
    expect(arabicRedirect('/')).toBeNull();
  });
});

describe('hasEnglishVersion', () => {
  it('is true only for the legal pages', () => {
    expect(hasEnglishVersion('/privacy')).toBe(true);
    expect(hasEnglishVersion('/terms')).toBe(true);
    expect(hasEnglishVersion('/pricing')).toBe(false);
    expect(hasEnglishVersion('/privacy-tips')).toBe(false);
  });
});
