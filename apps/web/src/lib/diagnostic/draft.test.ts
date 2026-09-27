import { FOLLOW_UPS, getQuestion, QUESTIONS, valueSchema } from '@sbn/question-bank';
import { sampleValue } from '@sbn/question-bank/testing';
import { describe, expect, it } from 'vitest';
import { type DraftByKind, emptyDraft, fromDraft, mayBeCentimes, toDraft } from './draft';

const context = { currency: 'JOD', country: 'JO', competitors: ['فنّي مستقل', 'شركة صيانة'] };

describe('drafts', () => {
  it('round-trip every sample answer of the 64 questions and the follow-ups unchanged', () => {
    for (const { id, field } of [...QUESTIONS, ...FOLLOW_UPS]) {
      const value = sampleValue(field);
      const conversion = fromDraft(field, toDraft(field, value, context));
      expect(conversion, id).toEqual({ ok: true, value });
    }
  });

  it('start empty drafts from the project, but never the report currency (D-111)', () => {
    expect(emptyDraft(getQuestion('F1').field, context)).toEqual({ amount: '', currency: 'JOD' });
    expect(emptyDraft(getQuestion('F8').field, context)).toBe('');
    expect(emptyDraft(getQuestion('A1').field, context)).toEqual({ country: 'JO', city: '' });
    expect(emptyDraft(getQuestion('D3').field, context)).toMatchObject({ items: { length: 3 } });
    expect(emptyDraft(getQuestion('D4').field, context)).toEqual({
      items: [
        { name: 'فنّي مستقل', amount: '', currency: 'JOD', unknown: false },
        { name: 'شركة صيانة', amount: '', currency: 'JOD', unknown: false },
      ],
    });
  });

  it('read numbers the way founders type them', () => {
    const field = getQuestion('F3').field;
    const draft: DraftByKind['cost_items'] = {
      items: [
        { label: 'قطع', amount: '١٢٫٥', currency: 'JOD' },
        { label: 'توصيل', amount: '2k', currency: 'JOD' },
      ],
    };
    expect(fromDraft(field, draft)).toEqual({
      ok: true,
      value: {
        items: [
          { label: 'قطع', amount: 12.5, currency: 'JOD' },
          { label: 'توصيل', amount: 2000, currency: 'JOD' },
        ],
      },
    });
  });

  it('report the boxes that do not hold a number', () => {
    expect(fromDraft(getQuestion('A6').field, 'عشرين')).toEqual({ ok: false, unreadable: [''] });
    const draft: DraftByKind['cost_items'] = {
      items: [{ label: 'قطع', amount: 'كثير', currency: 'JOD' }],
    };
    expect(fromDraft(getQuestion('F3').field, draft)).toEqual({
      ok: false,
      unreadable: ['items.0.amount'],
    });
  });

  it('leave empty numbers out so the server asks for them', () => {
    const result = fromDraft(getQuestion('F1').field, { amount: '', currency: 'JOD' });
    expect(result).toEqual({ ok: true, value: { amount: undefined, currency: 'JOD' } });
    if (result.ok)
      expect(valueSchema(getQuestion('F1').field).safeParse(result.value).success).toBe(false);
  });

  it('ask dinars or centimes and convert centimes (D-108)', () => {
    const field = getQuestion('F1').field;
    const millions = { amount: '2 مليون', currency: 'DZD' };
    expect(mayBeCentimes(field, millions)).toBe(true);
    expect(mayBeCentimes(field, { amount: '2 مليون', currency: 'JOD' })).toBe(false);
    expect(fromDraft(field, millions, true)).toEqual({
      ok: true,
      value: { amount: 20_000, currency: 'DZD' },
    });
    expect(fromDraft(field, millions, false)).toEqual({
      ok: true,
      value: { amount: 2_000_000, currency: 'DZD' },
    });
  });

  it('drop the parts that do not apply', () => {
    expect(fromDraft(getQuestion('D6').field, { answer: false, percent: '40' })).toEqual({
      ok: true,
      value: { answer: false },
    });
    expect(fromDraft(getQuestion('D7').field, { seasonal: false, peakMonths: [6] })).toEqual({
      ok: true,
      value: { seasonal: false, peakMonths: [] },
    });
    expect(fromDraft(getQuestion('C2').field, { ...emptyProfile(), sector: 'I' })).toEqual({
      ok: true,
      value: { sector: 'I' },
    });
  });
});

function emptyProfile(): DraftByKind['customer_profile'] {
  return {
    ageBand: '',
    city: '',
    incomeBand: '',
    occupation: '',
    sector: '',
    size: '',
    decisionMaker: '',
  };
}
