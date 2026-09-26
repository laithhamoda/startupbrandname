import { describe, expect, it } from 'vitest';
import { parseOnboarding } from './onboarding';

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

const complete = { country: 'JO', project: 'yes', terms: 'on' };

describe('parseOnboarding', () => {
  it('accepts a complete form without cross-border consent', () => {
    expect(parseOnboarding(form(complete))).toEqual({
      ok: true,
      answers: { country: 'JO', project: 'yes', terms: 'on' },
    });
  });

  it('accepts "no" to the project question: it is information only (D-086)', () => {
    const result = parseOnboarding(form({ ...complete, project: 'no' }));
    expect(result.ok && result.answers.project).toBe('no');
  });

  it('keeps cross-border consent when ticked', () => {
    const result = parseOnboarding(form({ ...complete, crossborder: 'on' }));
    expect(result.ok && result.answers.crossborder).toBe('on');
  });

  it('reports every missing answer', () => {
    expect(parseOnboarding(form({}))).toEqual({
      ok: false,
      invalid: expect.arrayContaining(['country', 'project', 'terms']) as unknown,
    });
  });

  it('rejects a country that is not in the list', () => {
    expect(parseOnboarding(form({ ...complete, country: 'ZZ' }))).toEqual({
      ok: false,
      invalid: ['country'],
    });
  });

  it('rejects answers other than yes and no', () => {
    expect(parseOnboarding(form({ ...complete, project: 'maybe' }))).toEqual({
      ok: false,
      invalid: ['project'],
    });
  });
});
