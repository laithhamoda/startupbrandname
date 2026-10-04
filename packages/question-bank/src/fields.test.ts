import { describe, expect, it } from 'vitest';
import { answerSchema, maxItemsFor, numberLimits, valueSchema } from './fields';
import { FOLLOW_UPS } from './follow-ups';
import { getQuestion, QUESTIONS } from './questions';
import { sampleValue } from './testing';
import type { Field, QuestionId } from './types';

const fieldOf = (id: QuestionId) => getQuestion(id).field;
const accepts = (field: Field, value: unknown) => valueSchema(field).safeParse(value).success;

describe('answer values', () => {
  it('trim text and refuse empty or overlong text', () => {
    expect(valueSchema(fieldOf('B2')).parse('  نص  ')).toBe('نص');
    expect(accepts(fieldOf('B2'), '   ')).toBe(false);
    expect(accepts(fieldOf('B3'), 'x'.repeat(601))).toBe(false);
  });

  it('keep numbers inside their bounds, whole where required', () => {
    expect(accepts(fieldOf('A2'), 3)).toBe(true);
    expect(accepts(fieldOf('A2'), 2.5)).toBe(false);
    expect(accepts(fieldOf('A2'), -1)).toBe(false);
    expect(accepts(fieldOf('A6'), 7.5)).toBe(true);
    expect(accepts(fieldOf('E7'), 0)).toBe(false);
  });

  it('accept only listed options, each once', () => {
    expect(accepts(fieldOf('A8'), 'main_income')).toBe(true);
    expect(accepts(fieldOf('A8'), 'hobby')).toBe(false);
    expect(accepts(fieldOf('H3'), { values: ['self', 'loan'] })).toBe(true);
    expect(accepts(fieldOf('H3'), { values: ['self', 'self'] })).toBe(false);
    expect(accepts(fieldOf('H3'), { values: [] })).toBe(false);
    expect(accepts(fieldOf('H3'), { values: ['self'], other: 'x' })).toBe(false);
    expect(accepts(fieldOf('A3'), { values: [], other: 'الطبخ' })).toBe(true);
  });

  it('require an explicit ISO currency on every amount', () => {
    expect(accepts(fieldOf('F1'), { amount: 25, currency: 'JOD' })).toBe(true);
    expect(accepts(fieldOf('F1'), { amount: 25 })).toBe(false);
    expect(accepts(fieldOf('F1'), { amount: 25, currency: 'دينار' })).toBe(false);
    expect(accepts(fieldOf('F1'), { amount: -1, currency: 'JOD' })).toBe(false);
    expect(accepts(fieldOf('F8'), 'DZD')).toBe(true);
    expect(accepts(fieldOf('A5'), { min: 5000, max: 3000, currency: 'JOD' })).toBe(false);
  });

  it('accept competitor websites on http or https with a domain name only', () => {
    const competitors = (url: string) => ({
      items: ['a', 'b', 'c'].map((name) => ({ name, url, strength: 's', weakness: 'w' })),
    });
    expect(accepts(fieldOf('D3'), competitors('https://example.com/prices'))).toBe(true);
    expect(accepts(fieldOf('D3'), competitors('http://shop.example.jo'))).toBe(true);
    // Arabic domain names, including Jordan's and Algeria's Arabic top-level domains.
    for (const url of ['https://موقع.com', 'https://مثال.الأردن', 'https://متجر.الجزائر/عروض']) {
      expect(accepts(fieldOf('D3'), competitors(url)), url).toBe(true);
    }
    for (const url of [
      'javascript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'file:///etc/passwd',
      'ftp://example.com',
      'http:example.com',
      'http://169.254.169.254/',
      'http://[::1]/',
      'http://localhost:3000',
    ]) {
      expect(accepts(fieldOf('D3'), competitors(url)), url).toBe(false);
    }
  });

  it('check lists: minimum items, required parts and totals', () => {
    const competitor = { name: 'n', strength: 's', weakness: 'w' };
    expect(accepts(fieldOf('D3'), { items: [competitor, competitor] })).toBe(false);
    expect(
      accepts(fieldOf('D3'), {
        items: [competitor, competitor, { ...competitor, url: 'not a url' }],
      }),
    ).toBe(false);
    expect(accepts(fieldOf('F3'), { items: [] })).toBe(false);
    expect(accepts(fieldOf('E3'), { items: [] })).toBe(true);
    expect(accepts(fieldOf('D4'), { items: [{ name: 'n', price: null }] })).toBe(true);
    expect(
      accepts(fieldOf('G4'), {
        items: [
          { label: 'a', percent: 60 },
          { label: 'b', percent: 40 },
        ],
      }),
    ).toBe(true);
    expect(
      accepts(fieldOf('G4'), {
        items: [
          { label: 'a', percent: 60 },
          { label: 'b', percent: 30 },
        ],
      }),
    ).toBe(false);
    expect(accepts(fieldOf('E8'), { items: [] })).toBe(true);
    expect(
      accepts(fieldOf('E8'), {
        items: [{ role: 'r', monthlyCost: { amount: 1, currency: 'JOD' }, startMonth: 40 }],
      }),
    ).toBe(false);
  });

  it('require the detail of combined answers when it applies', () => {
    expect(accepts(fieldOf('C5'), { answer: true })).toBe(true);
    expect(accepts(fieldOf('C5'), { answer: false })).toBe(false);
    expect(accepts(fieldOf('C5'), { answer: false, detail: 'الأهل' })).toBe(true);
    expect(accepts(fieldOf('D6'), { answer: true })).toBe(false);
    expect(accepts(fieldOf('D6'), { answer: true, percent: 30 })).toBe(true);
    expect(accepts(fieldOf('D7'), { seasonal: true, peakMonths: [] })).toBe(false);
    expect(accepts(fieldOf('D7'), { seasonal: true, peakMonths: [12, 12] })).toBe(false);
    expect(accepts(fieldOf('D7'), { seasonal: false, peakMonths: [] })).toBe(true);
  });

  it('shape the remaining kinds exactly', () => {
    expect(accepts(fieldOf('A1'), { country: 'JO', city: 'إربد' })).toBe(true);
    expect(accepts(fieldOf('A1'), { country: 'jo', city: 'إربد' })).toBe(false);
    expect(accepts(fieldOf('F6'), { month1: 1, month6: 2, month12: 3 })).toBe(true);
    expect(accepts(fieldOf('F6'), { month1: 1, month6: 2 })).toBe(false);
    expect(accepts(fieldOf('E2'), { items: ['a', 'b'] })).toBe(false);
    expect(accepts(fieldOf('C2'), {})).toBe(false);
    expect(accepts(fieldOf('C2'), { sector: 'O' })).toBe(false);
    expect(accepts(fieldOf('G3'), 'yes')).toBe(false);
  });

  it('reject unexpected keys', () => {
    expect(accepts(fieldOf('F1'), { amount: 1, currency: 'JOD', note: 'x' })).toBe(false);
  });
});

describe('limits the editor and the messages state', () => {
  const all = [...QUESTIONS, ...FOLLOW_UPS];

  it('cap every list at maxItemsFor, the same limit the schema applies (ARCH-M2)', () => {
    const lists = all.filter(({ field }) => maxItemsFor(field) !== null);
    expect(new Set(lists.map(({ field }) => field.kind))).toEqual(
      new Set([
        'cost_items',
        'people',
        'competitors',
        'competitor_prices',
        'percent_split',
        'staff_plan',
      ]),
    );
    for (const { id, field } of lists) {
      const max = maxItemsFor(field) ?? 0;
      const [row] = (sampleValue(field) as { items: { percent?: number }[] }).items;
      const rows = (count: number) => ({
        items: Array.from({ length: count }, () =>
          field.kind === 'percent_split' ? { ...row, percent: 100 / count } : row,
        ),
      });
      expect(accepts(field, rows(max)), id).toBe(true);
      const issues = valueSchema(field).safeParse(rows(max + 1)).error?.issues ?? [];
      expect(issues, id).toContainEqual(
        expect.objectContaining({
          code: 'too_big',
          origin: 'array',
          maximum: max,
          path: ['items'],
        }),
      );
    }
    expect(maxItemsFor(fieldOf('A6'))).toBeNull();
  });

  it('give the bounds of every number in an answer, read from its schema (UX-3)', () => {
    expect(numberLimits(fieldOf('A2'), '')).toEqual({ min: 0, max: 60 });
    expect(numberLimits(fieldOf('F3'), 'items.4.amount')).toEqual({ min: 0, max: 1e12 });
    expect(numberLimits(fieldOf('D4'), 'items.0.price.amount')).toEqual({ min: 0, max: 1e12 });
    expect(numberLimits(fieldOf('E8'), 'items.0.startMonth')).toEqual({ min: 1, max: 36 });
    expect(numberLimits(fieldOf('G4'), 'items.1.percent')).toEqual({ min: 0, max: 100 });
    expect(numberLimits(fieldOf('D6'), 'percent')).toEqual({ min: 0, max: 100 });

    // Every number in every sample answer has its bounds.
    const numbers = (value: unknown, path: string[] = []): string[] =>
      typeof value === 'number'
        ? [path.join('.')]
        : typeof value === 'object' && value !== null
          ? Object.entries(value).flatMap(([key, child]) => numbers(child, [...path, key]))
          : [];
    for (const { id, field } of all) {
      for (const path of numbers(sampleValue(field))) {
        expect(numberLimits(field, path), `${id} ${path}`).not.toBeNull();
      }
    }
  });

  it('give no bounds where the path holds no number', () => {
    expect(numberLimits(fieldOf('F3'), 'items.0.label')).toBeNull();
    expect(numberLimits(fieldOf('F3'), 'items')).toBeNull();
    expect(numberLimits(fieldOf('F3'), 'items.x.amount')).toBeNull();
    expect(numberLimits(fieldOf('B3'), '')).toBeNull();
    expect(numberLimits(fieldOf('E2'), 'items.0')).toBeNull();
  });
});

describe('answers', () => {
  it('store «لا أعرف» only where the question allows it (D-104)', () => {
    const f1 = getQuestion('F1');
    const b1 = getQuestion('B1');
    expect(answerSchema(f1.field, f1.allowUnknown).safeParse({ status: 'unknown' }).success).toBe(
      true,
    );
    expect(answerSchema(b1.field, b1.allowUnknown).safeParse({ status: 'unknown' }).success).toBe(
      false,
    );
    expect(
      answerSchema(f1.field, f1.allowUnknown).safeParse({ status: 'answered', value: 'x' }).success,
    ).toBe(false);
  });
});
