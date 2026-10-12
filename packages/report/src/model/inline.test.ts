import { describe, expect, it } from 'vitest';
import { concat, inl, inlineText, join, ltr, normalise, num, plain } from './inline';

describe('inline helpers', () => {
  it('make parts: text, a number and a left-to-right fragment', () => {
    expect(plain('x')).toEqual(['x']);
    expect(plain('')).toEqual([]);
    expect(num('1,200')).toEqual([{ n: '1,200' }]);
    expect(ltr('JOD')).toEqual([{ l: 'JOD' }]);
  });

  it('normalise joins neighbouring text and drops empty parts', () => {
    expect(normalise(['a', '', 'b', { n: '1' }, 'c', 'd'])).toEqual(['ab', { n: '1' }, 'cd']);
  });

  it('join and concat put phrases together', () => {
    expect(join([['a'], [{ n: '1' }], ['b']], ', ')).toEqual(['a, ', { n: '1' }, ', b']);
    expect(join([], ', ')).toEqual([]);
    expect(concat(['a'], ['b'], num('2'))).toEqual(['ab', { n: '2' }]);
  });

  it('inl builds a sentence from fixed text and slots', () => {
    expect(inl`from ${num('1')} to ${plain('x')}.`).toEqual(['from ', { n: '1' }, ' to x.']);
    expect(inl`no slots`).toEqual(['no slots']);
  });

  it('inlineText writes every kind of part as it is', () => {
    expect(inlineText(['a ', { n: '1' }, ' ', { l: 'T7' }])).toBe('a 1 T7');
  });
});
