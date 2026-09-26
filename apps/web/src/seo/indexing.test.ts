import { describe, expect, it } from 'vitest';
import { serverEnvSchema } from '@/env/server';
import { isIndexable } from './indexing';

const env = (values: Record<string, string>) => serverEnvSchema.parse(values);

describe('isIndexable', () => {
  it('is off by default', () => {
    expect(isIndexable(env({}))).toBe(false);
  });

  it('stays off in production until the flag is set', () => {
    expect(isIndexable(env({ VERCEL_ENV: 'production' }))).toBe(false);
  });

  it('stays off on previews even with the flag set', () => {
    expect(isIndexable(env({ VERCEL_ENV: 'preview', SITE_INDEXABLE: 'true' }))).toBe(false);
  });

  it('stays off locally even with the flag set', () => {
    expect(isIndexable(env({ SITE_INDEXABLE: 'true' }))).toBe(false);
  });

  it('turns on only for production with the flag set', () => {
    expect(isIndexable(env({ VERCEL_ENV: 'production', SITE_INDEXABLE: 'true' }))).toBe(true);
  });
});
