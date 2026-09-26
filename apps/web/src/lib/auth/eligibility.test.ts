import { describe, expect, it } from 'vitest';
import { parseEligibility, refusalOf } from './eligibility';

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

const complete = { country: 'JO', secondary: 'yes', adult: 'yes', terms: 'on' };

describe('parseEligibility', () => {
  it('accepts a complete form without cross-border consent', () => {
    expect(parseEligibility(form(complete))).toEqual({
      ok: true,
      answers: { country: 'JO', secondary: 'yes', adult: 'yes', terms: 'on' },
    });
  });

  it('keeps cross-border consent when ticked', () => {
    const result = parseEligibility(form({ ...complete, crossborder: 'on' }));
    expect(result.ok && result.answers.crossborder).toBe('on');
  });

  it('reports every missing answer', () => {
    expect(parseEligibility(form({}))).toEqual({
      ok: false,
      invalid: expect.arrayContaining(['country', 'secondary', 'adult', 'terms']) as unknown,
    });
  });

  it('rejects a country that is not in the list', () => {
    expect(parseEligibility(form({ ...complete, country: 'ZZ' }))).toEqual({
      ok: false,
      invalid: ['country'],
    });
  });

  it('rejects answers other than yes and no', () => {
    expect(parseEligibility(form({ ...complete, adult: 'maybe' }))).toEqual({
      ok: false,
      invalid: ['adult'],
    });
  });
});

describe('refusalOf', () => {
  it('lets through someone who answers yes twice', () => {
    expect(refusalOf({ secondary: 'yes', adult: 'yes' })).toBeNull();
  });

  it('refuses someone under 18', () => {
    expect(refusalOf({ secondary: 'yes', adult: 'no' })).toBe('adult');
  });

  it('refuses someone who has not finished secondary school, asked first', () => {
    expect(refusalOf({ secondary: 'no', adult: 'no' })).toBe('secondary');
  });
});
