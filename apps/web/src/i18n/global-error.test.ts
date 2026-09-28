import { describe, expect, it } from 'vitest';
import { GLOBAL_ERROR_TEXT } from './global-error';
import { catalogues } from './messages';

describe('GLOBAL_ERROR_TEXT', () => {
  it.each(['ar', 'en'] as const)('matches the errors messages (%s)', (locale) => {
    for (const [key, text] of Object.entries(GLOBAL_ERROR_TEXT[locale])) {
      expect(text, key).toBe(catalogues[locale].errors[key as keyof typeof GLOBAL_ERROR_TEXT.ar]);
    }
  });
});
