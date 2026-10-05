import { describe, expect, it } from 'vitest';
import { COUNTRY_CODES } from '@/lib/countries';
import { parseOnboarding } from './onboarding';
import { checkOnboarding } from './onboarding-check';

function form(fields: Record<string, string | Blob>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

const complete = { country: 'JO', project: 'yes', terms: 'on' };
const file = new File(['JO'], 'country.txt');

/** Forms the browser could submit, valid and not; the server must judge each one the same way. */
const CASES: [string, Record<string, string | Blob>][] = [
  ['a complete form', complete],
  ['"no" to the project question', { ...complete, project: 'no' }],
  ['the cross-border consent ticked', { ...complete, crossborder: 'on' }],
  ['an empty form', {}],
  ['only the country', { country: 'DZ' }],
  ['a country not in the list', { ...complete, country: 'ZZ' }],
  ['a country not offered (D-088)', { ...complete, country: 'IL' }],
  ['a country code in lower case', { ...complete, country: 'jo' }],
  ['an empty country', { ...complete, country: '' }],
  ['a file instead of a country', { ...complete, country: file }],
  ['an answer other than yes and no', { ...complete, project: 'maybe' }],
  ['"yes" in capitals', { ...complete, project: 'YES' }],
  ['the terms not ticked', { country: 'JO', project: 'yes' }],
  ['the terms with another value', { ...complete, terms: 'true' }],
  ['the terms empty', { ...complete, terms: '' }],
  ['the consent with another value', { ...complete, crossborder: 'off' }],
  ['the consent empty', { ...complete, crossborder: '' }],
  ['everything wrong', { country: 'XX', project: '1', terms: 'no', crossborder: 'yes' }],
  ['fields that are not asked', { ...complete, email: 'a@example.com', age: '17' }],
];

describe('checkOnboarding agrees with the server check (PERF-15)', () => {
  it.each(CASES)('%s', (_name, fields) => {
    expect(checkOnboarding(form(fields))).toEqual(parseOnboarding(form(fields)));
  });

  it('for every country offered', () => {
    for (const country of COUNTRY_CODES) {
      const fields = { ...complete, country };
      expect(checkOnboarding(form(fields))).toEqual(parseOnboarding(form(fields)));
    }
  });

  it('lists the invalid answers in the order they are asked', () => {
    expect(checkOnboarding(form({ crossborder: 'x' }))).toEqual({
      ok: false,
      invalid: ['country', 'project', 'terms', 'crossborder'],
    });
  });

  it('returns the consent only when it was ticked', () => {
    expect(checkOnboarding(form(complete))).toStrictEqual({
      ok: true,
      answers: { country: 'JO', project: 'yes', terms: 'on' },
    });
  });
});
