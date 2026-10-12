import { ENGINE_VERSION, type TaxRule } from '@sbn/engine';
import { describe, expect, it } from 'vitest';
import { canonicalText, inputHash, type RunInputs } from './input-hash';

const answered = (value: unknown) => ({ status: 'answered' as const, value });

const rule = (id: string, changes: Partial<TaxRule> = {}): TaxRule => ({
  id,
  countryCode: 'JO',
  legalForm: 'sole',
  regime: 'simple',
  levy: id,
  kind: 'tax',
  basis: 'turnover',
  rate: { num: 1n, den: 20n },
  brackets: [],
  fixedAmount: null,
  minimum: { minor: 1000n, currency: 'JOD' },
  turnoverCeiling: null,
  paymentMonth: 4,
  currency: 'JOD',
  effectiveFrom: '2026-01-01',
  sourceUrl: 'https://example.test/rule',
  lastVerified: '2026-09-01',
  status: 'verified',
  ...changes,
});

const base: RunInputs = {
  country: 'JO',
  currency: 'JOD',
  mode: 'full',
  referenceMonth: '2026-10',
  answers: {
    F1: answered({ amount: 25.5, currency: 'JOD' }),
    F3: answered({ items: [{ label: 'قطع', amount: 8, currency: 'JOD' }] }),
  },
  provenance: {
    F1: { source: 'user', confidence: 'medium', validated: false },
    F3: { source: 'assumption', confidence: 'low', validated: false },
  },
  taxRules: [rule('a'), rule('b')],
  overrides: {},
  options: { premiumAllowed: false },
};

describe('canonicalText', () => {
  it('sorts keys at every depth, so the order they were built in never shows', () => {
    expect(canonicalText({ b: 1, a: { d: 2, c: [{ y: 1, x: 2 }] } })).toBe(
      canonicalText({ a: { c: [{ x: 2, y: 1 }], d: 2 }, b: 1 }),
    );
  });

  it('keeps the order of a list, which is meaningful', () => {
    expect(canonicalText([1, 2])).not.toBe(canonicalText([2, 1]));
  });

  it('writes a bigint as digits with an n, and keeps fractions', () => {
    expect(canonicalText({ minor: 1500n, amount: 1.5 })).toBe('{"amount":1.5,"minor":"1500n"}');
  });

  it('drops a key whose value is undefined, as JSON would', () => {
    expect(canonicalText({ a: 1, b: undefined })).toBe(canonicalText({ a: 1 }));
  });

  it('tells a number from the same digits as text', () => {
    expect(canonicalText({ a: 1 })).not.toBe(canonicalText({ a: '1' }));
  });
});

describe('inputHash (rule 4, D-238)', () => {
  it('is a sha256 in lower-case hexadecimal', () => {
    expect(inputHash(base)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is the same for the same inputs, however the unordered ones were built', () => {
    const rebuilt: RunInputs = {
      ...base,
      answers: { F3: base.answers.F3, F1: base.answers.F1 },
      provenance: { F3: base.provenance.F3, F1: base.provenance.F1 },
      taxRules: [rule('b'), rule('a')],
    };
    expect(inputHash(rebuilt)).toBe(inputHash(base));
  });

  it('is the same on any day of the same month', () => {
    // The input is the month, not the day (D-251).
    expect(inputHash({ ...base, referenceMonth: '2026-10' })).toBe(inputHash(base));
  });

  const changes: [string, Partial<RunInputs>][] = [
    ['an answer', { answers: { ...base.answers, F1: answered({ amount: 26, currency: 'JOD' }) } }],
    ['an answer added', { answers: { ...base.answers, F4: answered({ items: [] }) } }],
    [
      'an answer’s currency',
      { answers: { ...base.answers, F1: answered({ amount: 25.5, currency: 'USD' }) } },
    ],
    ['an unknown answer', { answers: { ...base.answers, F1: { status: 'unknown' } } }],
    [
      'the provenance of an answer',
      {
        provenance: {
          ...base.provenance,
          F1: { source: 'assumption', confidence: 'medium', validated: false },
        },
      },
    ],
    [
      'the confidence of an answer',
      {
        provenance: {
          ...base.provenance,
          F1: { source: 'user', confidence: 'high', validated: false },
        },
      },
    ],
    [
      'whether an answer is validated',
      {
        provenance: {
          ...base.provenance,
          F1: { source: 'user', confidence: 'medium', validated: true },
        },
      },
    ],
    ['the country', { country: 'DZ' }],
    ['the currency', { currency: 'DZD' }],
    ['the mode', { mode: 'quick' }],
    ['the month of the run', { referenceMonth: '2026-11' }],
    ['a tax rule’s rate', { taxRules: [rule('a', { rate: { num: 1n, den: 10n } }), rule('b')] }],
    ['a tax rule’s status', { taxRules: [rule('a', { status: 'unverified' }), rule('b')] }],
    ['a tax rule’s minimum', { taxRules: [rule('a', { minimum: null }), rule('b')] }],
    ['a rule removed', { taxRules: [rule('a')] }],
    ['no rules at all', { taxRules: [] }],
    [
      'a parameter override',
      {
        overrides: {
          horizonMonths: {
            value: 24,
            source: 'user',
            confidence: 'high',
            validated: true,
            inputs: [],
          },
        },
      },
    ],
    ['the pricing options', { options: { premiumAllowed: true } }],
  ];

  it.each(changes)('changes with %s', (_name, change) => {
    expect(inputHash({ ...base, ...change })).not.toBe(inputHash(base));
  });

  it('changes with the engine version, so a changed formula makes a new row', () => {
    expect(inputHash(base, '9.9.9')).not.toBe(inputHash(base));
    expect(inputHash(base, ENGINE_VERSION)).toBe(inputHash(base));
  });

  it('gives each of the changes above a hash of its own', () => {
    const hashes = new Set(
      [base, ...changes.map(([, change]) => ({ ...base, ...change }))].map((inputs) =>
        inputHash(inputs),
      ),
    );
    expect(hashes.size).toBe(changes.length + 1);
  });
});
