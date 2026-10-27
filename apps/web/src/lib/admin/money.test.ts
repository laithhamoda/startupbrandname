import { describe, expect, it } from 'vitest';
import { centsToUsd, usdToCents } from './money';

describe('usdToCents', () => {
  it.each([
    ['2', 200],
    ['2.5', 250],
    ['2.50', 250],
    ['0.05', 5],
    ['0', 0],
    [' 12.34 ', 1234],
    ['9999.99', 999999],
  ])('reads %s as %i cents', (text, cents) => {
    expect(usdToCents(text)).toBe(cents);
  });

  it.each(['', 'abc', '2.555', '-1', '1,5', '.5', '2.', '10000', '1e3', '1 000'])(
    'refuses "%s"',
    (text) => {
      expect(usdToCents(text)).toBeNull();
    },
  );
});

describe('centsToUsd', () => {
  it.each([
    [250, '2.50'],
    [5, '0.05'],
    [0, '0.00'],
    [100000, '1000.00'],
    [-250, '-2.50'],
  ])('shows %i cents as %s', (cents, text) => {
    expect(centsToUsd(cents)).toBe(text);
  });
});
