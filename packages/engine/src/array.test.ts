import { describe, expect, it } from 'vitest';
import { at } from './array';

describe('at', () => {
  it('returns the item at a position, counted from 0', () => {
    expect(at(['a', 'b', 'c'], 0)).toBe('a');
    expect(at([1n, 2n], 1)).toBe(2n);
  });

  it('stops with length_mismatch past the end, before the start, or on a hole', () => {
    for (const index of [3, -1, 0.5]) {
      expect(() => at(['a', 'b', 'c'], index)).toThrow(
        expect.objectContaining({ code: 'length_mismatch' }) as Error,
      );
    }
    expect(() => at([], 0)).toThrow(expect.objectContaining({ code: 'length_mismatch' }) as Error);
  });
});
