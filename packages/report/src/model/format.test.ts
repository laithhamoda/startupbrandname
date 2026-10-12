import { makeMoney, makeRate } from '@sbn/engine';
import { describe, expect, it } from 'vitest';
import {
  MINUS,
  formatDate,
  formatInteger,
  formatMoneyNumber,
  formatPercent,
  formatRatio,
  formatSignedPercent,
  groupThousands,
  isLatinLabel,
  labelOfCurrency,
  trimDecimalZeros,
} from './format';

describe('groupThousands', () => {
  it('puts a comma between thousands', () => {
    expect(['0', '12', '123', '1234', '12345', '123456', '1234567'].map(groupThousands)).toEqual([
      '0',
      '12',
      '123',
      '1,234',
      '12,345',
      '123,456',
      '1,234,567',
    ]);
  });
});

describe('formatInteger', () => {
  it('groups whole numbers and signs the negative ones with the real minus', () => {
    expect(formatInteger(1800)).toBe('1,800');
    expect(formatInteger(-5200n)).toBe(`${MINUS}5,200`);
    expect(formatInteger(0)).toBe('0');
    expect(formatInteger(12345678901234567890n)).toBe('12,345,678,901,234,567,890');
  });
});

describe('formatMoneyNumber', () => {
  it('keeps the decimals of the currency: three for the Jordanian dinar', () => {
    expect(formatMoneyNumber(makeMoney(18_400_000n, 'JOD'))).toBe('18,400.000');
    expect(formatMoneyNumber(makeMoney(5n, 'JOD'))).toBe('0.005');
  });

  it('keeps two decimals for the Algerian dinar and none for the yen', () => {
    expect(formatMoneyNumber(makeMoney(500_000_000n, 'DZD'))).toBe('5,000,000.00');
    expect(formatMoneyNumber(makeMoney(1234n, 'JPY'))).toBe('1,234');
  });

  it('writes a negative amount with a minus sign, including below one unit', () => {
    expect(formatMoneyNumber(makeMoney(-2_600_000n, 'JOD'))).toBe(`${MINUS}2,600.000`);
    expect(formatMoneyNumber(makeMoney(-5n, 'JOD'))).toBe(`${MINUS}0.005`);
  });

  it('does not lose precision above the safe integer range', () => {
    expect(formatMoneyNumber(makeMoney(9_007_199_254_740_993_000n, 'JOD'))).toBe(
      '9,007,199,254,740,993.000',
    );
  });
});

describe('trimDecimalZeros', () => {
  it('drops trailing zeros and a bare point, and leaves whole numbers alone', () => {
    expect(trimDecimalZeros('37.50')).toBe('37.5');
    expect(trimDecimalZeros('60.00')).toBe('60');
    expect(trimDecimalZeros('100')).toBe('100');
    expect(trimDecimalZeros('0.0')).toBe('0');
    expect(trimDecimalZeros('10.05')).toBe('10.05');
    expect(trimDecimalZeros(`1.${'0'.repeat(50_000)}`)).toBe('1');
  });
});

describe('formatPercent, formatSignedPercent and formatRatio', () => {
  it('write a rate as a percentage with at most two decimals', () => {
    expect(formatPercent(makeRate(3n, 8n))).toBe('37.5%');
    expect(formatPercent(makeRate(3n, 5n))).toBe('60%');
    expect(formatPercent(makeRate(1n, 3n))).toBe('33.33%');
  });

  it('use the real minus sign', () => {
    expect(formatPercent(makeRate(-131n, 500n))).toBe(`${MINUS}26.2%`);
  });

  it('always show the sign of a change, and none for zero', () => {
    expect(formatSignedPercent(makeRate(2n, 5n))).toBe('+40%');
    expect(formatSignedPercent(makeRate(-1n, 10n))).toBe(`${MINUS}10%`);
    expect(formatSignedPercent(makeRate(0n, 1n))).toBe('0%');
  });

  it('write a ratio as a plain number', () => {
    expect(formatRatio(makeRate(8n, 1n))).toBe('8');
    expect(formatRatio(makeRate(3n, 5n))).toBe('0.6');
    expect(formatRatio(makeRate(11n, 10n))).toBe('1.1');
    expect(formatRatio(makeRate(-3n, 2n))).toBe(`${MINUS}1.5`);
  });
});

describe('formatDate', () => {
  it('returns a real date as it was given and refuses anything else', () => {
    expect(formatDate('2026-10-12')).toBe('2026-10-12');
    expect(() => formatDate('2026-02-30')).toThrow();
    expect(() => formatDate('12/10/2026')).toThrow();
  });
});

describe('currency labels', () => {
  const project = { currency: 'JOD', currencyLabel: 'د.أ' };

  it('use the project label for the project currency and the code for any other', () => {
    expect(labelOfCurrency('JOD', project)).toBe('د.أ');
    expect(labelOfCurrency('USD', project)).toBe('USD');
  });

  it('tell a Latin code, which reads left to right, from an Arabic label', () => {
    expect(isLatinLabel('USD')).toBe(true);
    expect(isLatinLabel('د.أ')).toBe(false);
    expect(isLatinLabel('')).toBe(false);
  });
});
