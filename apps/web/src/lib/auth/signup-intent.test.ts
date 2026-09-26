import { describe, expect, it } from 'vitest';
import { parseSignupIntent, serializeSignupIntent } from './signup-intent';

describe('signup intent', () => {
  it('round-trips a valid intent', () => {
    const intent = { country: 'JO', locale: 'ar', crossborder: true } as const;
    expect(parseSignupIntent(serializeSignupIntent(intent))).toEqual(intent);
  });

  it.each([
    undefined,
    '',
    'not json',
    '{"country":"ZZ","locale":"ar","crossborder":false}',
    '{"country":"JO","locale":"fr","crossborder":false}',
    '{"country":"JO","locale":"ar"}',
  ])('ignores %j', (raw) => {
    expect(parseSignupIntent(raw)).toBeNull();
  });

  it('drops anything it does not know', () => {
    expect(
      parseSignupIntent('{"country":"JO","locale":"en","crossborder":false,"email":"a@b.c"}'),
    ).toEqual({ country: 'JO', locale: 'en', crossborder: false });
  });
});
