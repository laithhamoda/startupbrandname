import { FOLLOW_UPS, getQuestion, QUESTIONS, valueSchema } from '@sbn/question-bank';
import { sampleValue } from '@sbn/question-bank/testing';
import { describe, expect, it } from 'vitest';
import {
  type DraftByKind,
  emptyDraft,
  fromDraft,
  isSingleControl,
  mayBeCentimes,
  toDraft,
  withText,
} from './draft';

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
    expect(fromDraft(getQuestion('A6').field, 'عشرين')).toEqual({
      ok: false,
      unreadable: [''],
      choice: null,
    });
    const draft: DraftByKind['cost_items'] = {
      items: [{ label: 'قطع', amount: 'كثير', currency: 'JOD' }],
    };
    expect(fromDraft(getQuestion('F3').field, draft)).toEqual({
      ok: false,
      unreadable: ['items.0.amount'],
      choice: null,
    });
  });

  it('ask which reading a number with one separator has, once the rest is readable (UX-2)', () => {
    const field = getQuestion('F3').field;
    const draft: DraftByKind['cost_items'] = {
      items: [
        { label: 'قطع', amount: '12,5', currency: 'JOD' },
        { label: 'توصيل', amount: '١.٥٠٠', currency: 'JOD' },
        { label: 'تغليف', amount: '1,500', currency: 'JOD' },
      ],
    };
    const conversion = fromDraft(field, draft);
    expect(conversion).toMatchObject({
      ok: false,
      unreadable: [],
      choice: { path: 'items.1.amount', typed: '١.٥٠٠' },
    });
    if (conversion.ok || !conversion.choice) return;
    const [grouped] = conversion.choice.readings;
    expect(grouped?.value).toBe(1500);

    // The pick replaces only that box; the next box is asked about in turn.
    const picked = withText(draft, conversion.choice.draftPath, grouped?.text ?? '');
    expect(picked).toEqual({
      items: [draft.items[0], { ...draft.items[1], amount: '1500' }, draft.items[2]],
    });
    expect(fromDraft(field, picked)).toMatchObject({ choice: { path: 'items.2.amount' } });

    // An unreadable box comes first.
    expect(
      fromDraft(field, {
        items: [...draft.items, { label: 'x', amount: 'كثير', currency: 'JOD' }],
      }),
    ).toMatchObject({ unreadable: ['items.3.amount'], choice: { path: 'items.1.amount' } });
  });

  it('name unreadable boxes by their path in the value, as the server does (UX-3)', () => {
    const prices: DraftByKind['competitor_prices'] = {
      items: [{ name: 'فنّي', amount: 'كثير', currency: 'JOD', unknown: false }],
    };
    expect(fromDraft(getQuestion('D4').field, prices)).toMatchObject({
      unreadable: ['items.0.price.amount'],
    });
    const staff: DraftByKind['staff_plan'] = {
      items: [{ role: 'فنّي', amount: '1.500', currency: 'JOD', startMonth: 'ثلاثة' }],
    };
    expect(fromDraft(getQuestion('E8').field, staff)).toMatchObject({
      unreadable: ['items.0.startMonth'],
      choice: { path: 'items.0.monthlyCost.amount', draftPath: 'items.0.amount' },
    });
  });

  it('tell answers made of one control from those made of several', () => {
    expect(isSingleControl(getQuestion('B3').field)).toBe(true);
    expect(isSingleControl(getQuestion('A6').field)).toBe(true);
    expect(isSingleControl(getQuestion('C1').field)).toBe(true);
    expect(isSingleControl(getQuestion('F3').field)).toBe(false);
    expect(isSingleControl(getQuestion('D6').field)).toBe(false);
  });

  it('put a picked reading back into a number answer', () => {
    expect(withText('1.500', '', '1.5')).toBe('1.5');
    expect(fromDraft(getQuestion('A6').field, '1,500')).toMatchObject({ choice: { path: '' } });
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
