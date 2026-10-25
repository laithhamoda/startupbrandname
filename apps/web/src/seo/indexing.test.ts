import { describe, expect, it } from 'vitest';
import { serverEnvSchema } from '@/env/server';
import { crawlerPolicy, isIndexable } from './indexing';

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

describe('crawlerPolicy (D-303)', () => {
  it('is closed by default and in production without a flag', () => {
    expect(crawlerPolicy(env({}))).toBe('closed');
    expect(crawlerPolicy(env({ VERCEL_ENV: 'production' }))).toBe('closed');
  });

  it('lets only the AI crawlers in with AI_CRAWLERS_ALLOWED, in production', () => {
    expect(crawlerPolicy(env({ VERCEL_ENV: 'production', AI_CRAWLERS_ALLOWED: 'true' }))).toBe(
      'ai-only',
    );
  });

  it('ignores AI_CRAWLERS_ALLOWED on previews and locally', () => {
    expect(crawlerPolicy(env({ VERCEL_ENV: 'preview', AI_CRAWLERS_ALLOWED: 'true' }))).toBe(
      'closed',
    );
    expect(crawlerPolicy(env({ AI_CRAWLERS_ALLOWED: 'true' }))).toBe('closed');
  });

  it('is open at launch, whatever the AI flag says', () => {
    expect(crawlerPolicy(env({ VERCEL_ENV: 'production', SITE_INDEXABLE: 'true' }))).toBe('open');
    expect(
      crawlerPolicy(
        env({ VERCEL_ENV: 'production', SITE_INDEXABLE: 'true', AI_CRAWLERS_ALLOWED: 'false' }),
      ),
    ).toBe('open');
  });
});
