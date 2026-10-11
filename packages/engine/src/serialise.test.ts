import { describe, expect, it } from 'vitest';
import { makeMoney } from './money';
import { makeRate } from './rate';
import { canonicalJson } from './serialise';

describe('canonicalJson', () => {
  it('writes bigints as decimal strings and rates as numerator/denominator strings', () => {
    expect(canonicalJson({ units: 12345678901234567890n, share: makeRate(1n, 3n) })).toBe(
      '{ "share": "1/3", "units": "12345678901234567890" }\n',
    );
    expect(canonicalJson(makeRate(-3n, 2n))).toBe('"-3/2"\n');
    expect(canonicalJson(makeRate(5n, 1n))).toBe('"5/1"\n');
    expect(canonicalJson(-7n)).toBe('"-7"\n');
  });

  it('writes money as its currency and its minor units in a string', () => {
    expect(canonicalJson(makeMoney(-1500n, 'JOD'))).toBe(
      '{ "currency": "JOD", "minor": "-1500" }\n',
    );
  });

  it('sorts keys by code unit, whatever the order they were built in', () => {
    const a = canonicalJson({ b: 1, a: 2, C: 3, 10: 4, 2: 5 });
    const b = canonicalJson({ 2: 5, 10: 4, C: 3, a: 2, b: 1 });
    expect(a).toBe(b);
    // "10" < "2" < "C" < "a" < "b": digits, then capitals, then lower case, by code unit.
    expect(a).toBe('{ "10": 4, "2": 5, "C": 3, "a": 2, "b": 1 }\n');
  });

  it('leaves out a key whose value is undefined, and keeps null', () => {
    expect(canonicalJson({ a: undefined, b: null })).toBe('{ "b": null }\n');
  });

  it('writes booleans, strings and whole numbers', () => {
    expect(canonicalJson([true, false, 'a "quoted" word', 0, -5, 36])).toBe(
      '[true, false, "a \\"quoted\\" word", 0, -5, 36]\n',
    );
  });

  it('writes Arabic text as it is, in UTF-8', () => {
    expect(canonicalJson('نقطة التعادل')).toBe('"نقطة التعادل"\n');
  });

  it('keeps short containers of scalars on one line and breaks the rest', () => {
    expect(canonicalJson({ a: [1, 2, 3], b: {}, c: [] })).toBe(
      ['{', '  "a": [1, 2, 3],', '  "b": {},', '  "c": []', '}', ''].join('\n'),
    );
  });

  it('breaks a long list of scalars, one to a line, and nested containers by indent', () => {
    const long = Array.from({ length: 40 }, (_, index) => index * 1000);
    const text = canonicalJson({ list: long, deep: { inner: [{ x: 1n }, { y: 2n }] } });
    const lines = text.split('\n');
    expect(lines[0]).toBe('{');
    expect(lines).toContain('  "deep": {');
    expect(lines).toContain('    "inner": [');
    expect(lines).toContain('      { "x": "1" },');
    expect(lines).toContain('      { "y": "2" }');
    expect(lines).toContain('    0,');
    expect(lines.some((line) => line.length > 100)).toBe(false);
  });

  it('ends with exactly one newline and is valid JSON', () => {
    const value = {
      money: makeMoney(5n, 'DZD'),
      months: [1, 2],
      nested: { rate: makeRate(1n, 2n) },
    };
    const text = canonicalJson(value);
    expect(text.endsWith('}\n')).toBe(true);
    expect(text.endsWith('\n\n')).toBe(false);
    expect(JSON.parse(text)).toEqual({
      money: { currency: 'DZD', minor: '5' },
      months: [1, 2],
      nested: { rate: '1/2' },
    });
  });

  it('gives the same text for equal values, and for the same value twice', () => {
    const make = () => ({ a: [makeMoney(1n, 'JOD')], b: makeRate(2n, 3n) });
    expect(canonicalJson(make())).toBe(canonicalJson(make()));
  });

  it('refuses what would make the text unstable', () => {
    for (const bad of [1.5, Number.NaN, Number.POSITIVE_INFINITY, 2 ** 60]) {
      expect(() => canonicalJson({ bad })).toThrow(
        expect.objectContaining({ code: 'unserialisable' }) as Error,
      );
    }
    for (const bad of [new Date(0), new Map(), () => 1, Symbol('x'), [undefined]]) {
      expect(() => canonicalJson({ bad })).toThrow(
        expect.objectContaining({ code: 'unserialisable' }) as Error,
      );
    }
    expect(() => canonicalJson(undefined)).toThrow(
      expect.objectContaining({ code: 'unserialisable' }) as Error,
    );
  });

  it('writes an object without a prototype', () => {
    const bare = Object.assign(Object.create(null) as Record<string, unknown>, { z: 1n });
    expect(canonicalJson(bare)).toBe('{ "z": "1" }\n');
  });

  it('does not take an object with more than num and den for a rate', () => {
    expect(canonicalJson({ num: 1n, den: 2n, extra: 3n })).toBe(
      '{ "den": "2", "extra": "3", "num": "1" }\n',
    );
    expect(canonicalJson({ num: 1n, den: '2' })).toBe('{ "den": "2", "num": "1" }\n');
  });
});
