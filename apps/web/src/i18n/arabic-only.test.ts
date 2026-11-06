import { describe, expect, it } from 'vitest';
import {
  aiContextRedirect,
  aiContextRewrite,
  arabicRedirect,
  hasEnglishVersion,
} from './arabic-only';

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

describe('the AI context page (D-337)', () => {
  it('is served at /ai-context from the English locale', () => {
    expect(aiContextRewrite('/ai-context')).toBe('/en/ai-context');
    expect(aiContextRewrite('/ai-context/x')).toBeNull();
    expect(aiContextRewrite('/ar/ai-context')).toBeNull();
  });

  it('sends its /ar and /en addresses to the one address', () => {
    expect(aiContextRedirect('/ar/ai-context')).toBe('/ai-context');
    expect(aiContextRedirect('/en/ai-context')).toBe('/ai-context');
    expect(aiContextRedirect('/ai-context')).toBeNull();
    expect(aiContextRedirect('/ar/pricing')).toBeNull();
  });
});
