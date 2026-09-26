import { describe, expect, it } from 'vitest';
import { catalogues } from './messages';

function leaves(value: unknown, prefix = ''): Map<string, unknown> {
  const result = new Map<string, unknown>();
  if (typeof value === 'object' && value !== null) {
    for (const [key, child] of Object.entries(value)) {
      for (const [path, leaf] of leaves(child, prefix ? `${prefix}.${key}` : key)) {
        result.set(path, leaf);
      }
    }
  } else {
    result.set(prefix, value);
  }
  return result;
}

describe('message catalogues', () => {
  const arabic = leaves(catalogues.ar);
  const english = leaves(catalogues.en);

  it('have exactly the same keys in Arabic and English', () => {
    expect([...english.keys()].sort()).toEqual([...arabic.keys()].sort());
  });

  it.each([
    ['ar', arabic],
    ['en', english],
  ])('contain only non-empty strings (%s)', (_locale, messages) => {
    for (const [key, text] of messages) {
      expect(typeof text, key).toBe('string');
      expect(String(text).trim(), key).not.toBe('');
    }
  });

  it('use the same ICU placeholders in both languages', () => {
    const placeholders = (text: unknown) =>
      [...String(text).matchAll(/\{(\w+)/g)].map((match) => match[1]).sort();
    for (const [key, text] of arabic) {
      expect(placeholders(english.get(key)), key).toEqual(placeholders(text));
    }
  });
});
