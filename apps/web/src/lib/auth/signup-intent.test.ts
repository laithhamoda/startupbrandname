import { describe, expect, it } from 'vitest';
import { parseSignupIntent, serializeSignupIntent } from './signup-intent';

describe('signup intent', () => {
  it('round-trips a valid intent', () => {
    const intent = { country: 'JO', locale: 'ar', hasProject: true, crossborder: true } as const;
    expect(parseSignupIntent(serializeSignupIntent(intent))).toEqual(intent);
  });

  it.each([
    undefined,
    '',
    'not json',
    '{"country":"ZZ","locale":"ar","hasProject":true,"crossborder":false}',
    '{"country":"JO","locale":"fr","hasProject":true,"crossborder":false}',
    '{"country":"JO","locale":"ar","crossborder":false}',
    '{"country":"JO","locale":"ar","hasProject":"yes","crossborder":false}',
  ])('ignores %j', (raw) => {
    expect(parseSignupIntent(raw)).toBeNull();
  });

  it('drops anything it does not know', () => {
    expect(
      parseSignupIntent(
        '{"country":"JO","locale":"en","hasProject":false,"crossborder":false,"email":"a@b.c"}',
      ),
    ).toEqual({ country: 'JO', locale: 'en', hasProject: false, crossborder: false });
  });
});
