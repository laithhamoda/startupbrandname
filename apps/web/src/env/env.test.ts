import { describe, expect, it } from 'vitest';
import { clientEnvSchema } from './client';
import { booleanFlag, serverEnvSchema } from './server';

const validClient = {
  NEXT_PUBLIC_SUPABASE_URL: 'https://abc.supabase.co',
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_abc123',
};

describe('clientEnvSchema', () => {
  it('accepts a URL and a publishable key', () => {
    expect(clientEnvSchema.parse(validClient)).toEqual(validClient);
  });

  it('rejects a secret key in the publishable slot', () => {
    expect(() =>
      clientEnvSchema.parse({
        ...validClient,
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_abc123',
      }),
    ).toThrow();
  });

  it('rejects a malformed URL', () => {
    expect(() =>
      clientEnvSchema.parse({ ...validClient, NEXT_PUBLIC_SUPABASE_URL: 'abc.supabase.co' }),
    ).toThrow();
  });

  it('declares only NEXT_PUBLIC_ variables', () => {
    for (const key of Object.keys(clientEnvSchema.shape)) {
      expect(key).toMatch(/^NEXT_PUBLIC_/);
    }
  });
});

describe('booleanFlag', () => {
  it.each([
    ['true', true],
    ['false', false],
  ])('parses %j as %j', (input, expected) => {
    expect(booleanFlag.parse(input)).toBe(expected);
  });

  it.each(['', '0', '1', 'yes', 'False', 'TRUE'])('rejects %j', (input) => {
    expect(() => booleanFlag.parse(input)).toThrow();
  });
});

describe('serverEnvSchema', () => {
  it('keeps the Algeria market closed when the flag is unset', () => {
    expect(serverEnvSchema.parse({}).MARKET_DZ_ENABLED).toBe(false);
  });

  it('keeps the Algeria market closed when the flag is "false"', () => {
    expect(serverEnvSchema.parse({ MARKET_DZ_ENABLED: 'false' }).MARKET_DZ_ENABLED).toBe(false);
  });

  it('opens the Algeria market only on "true"', () => {
    expect(serverEnvSchema.parse({ MARKET_DZ_ENABLED: 'true' }).MARKET_DZ_ENABLED).toBe(true);
  });

  it('defaults LOG_LEVEL to info', () => {
    expect(serverEnvSchema.parse({}).LOG_LEVEL).toBe('info');
  });

  it('drops variables it does not declare', () => {
    expect(serverEnvSchema.parse({ SOME_SECRET: 'value' })).not.toHaveProperty('SOME_SECRET');
  });
});
