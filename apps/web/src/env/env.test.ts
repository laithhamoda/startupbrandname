import { describe, expect, it } from 'vitest';
import { clientEnvSchema } from './client';
import { booleanFlag, emailList, serverEnvSchema } from './server';

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

describe('emailList', () => {
  it('trims, lower-cases and drops blanks and repeats', () => {
    expect(emailList.parse(' Owner@Example.com ,, owner@example.com,second@example.org ')).toEqual([
      'owner@example.com',
      'second@example.org',
    ]);
  });

  it('reads an empty value as nobody', () => {
    expect(emailList.parse('')).toEqual([]);
    expect(emailList.parse(' , ')).toEqual([]);
  });

  it('rejects the whole list when one address is malformed', () => {
    expect(() => emailList.parse('owner@example.com,not-an-email')).toThrow();
  });

  it('rejects more than 20 addresses', () => {
    const many = Array.from({ length: 21 }, (_, index) => `user${String(index)}@example.com`).join(
      ',',
    );
    expect(() => emailList.parse(many)).toThrow();
  });
});

describe('serverEnvSchema', () => {
  it('lets nobody preview the full report by default (D-245)', () => {
    expect(serverEnvSchema.parse({}).FULL_REPORT_PREVIEW_EMAILS).toEqual([]);
    expect(
      serverEnvSchema.parse({ FULL_REPORT_PREVIEW_EMAILS: '' }).FULL_REPORT_PREVIEW_EMAILS,
    ).toEqual([]);
  });

  it('reads the preview allow-list as lower-case addresses', () => {
    expect(
      serverEnvSchema.parse({ FULL_REPORT_PREVIEW_EMAILS: 'Owner@Example.com' })
        .FULL_REPORT_PREVIEW_EMAILS,
    ).toEqual(['owner@example.com']);
  });

  it('refuses a malformed preview allow-list instead of reading it as empty', () => {
    expect(() => serverEnvSchema.parse({ FULL_REPORT_PREVIEW_EMAILS: 'owner@' })).toThrow();
  });

  it('keeps the Algeria market open when the flag is unset (D-068)', () => {
    expect(serverEnvSchema.parse({}).MARKET_DZ_ENABLED).toBe(true);
  });

  it('closes the Algeria market on "false"', () => {
    expect(serverEnvSchema.parse({ MARKET_DZ_ENABLED: 'false' }).MARKET_DZ_ENABLED).toBe(false);
  });

  it('keeps it open on "true"', () => {
    expect(serverEnvSchema.parse({ MARKET_DZ_ENABLED: 'true' }).MARKET_DZ_ENABLED).toBe(true);
  });

  it('hides Google sign-in until it is switched on', () => {
    expect(serverEnvSchema.parse({}).AUTH_GOOGLE_ENABLED).toBe(false);
    expect(serverEnvSchema.parse({ AUTH_GOOGLE_ENABLED: 'true' }).AUTH_GOOGLE_ENABLED).toBe(true);
  });

  it('defaults LOG_LEVEL to info', () => {
    expect(serverEnvSchema.parse({}).LOG_LEVEL).toBe('info');
  });

  it('drops variables it does not declare', () => {
    expect(serverEnvSchema.parse({ SOME_SECRET: 'value' })).not.toHaveProperty('SOME_SECRET');
  });

  it('uses Anthropic by default and accepts only the known AI providers (D-123)', () => {
    expect(serverEnvSchema.parse({}).AI_PROVIDER).toBe('anthropic');
    expect(serverEnvSchema.parse({ AI_PROVIDER: 'fake' }).AI_PROVIDER).toBe('fake');
    expect(() => serverEnvSchema.parse({ AI_PROVIDER: 'openai' })).toThrow();
    expect(serverEnvSchema.parse({}).ANTHROPIC_API_KEY).toBeUndefined();
  });
});
