import { describe, expect, it } from 'vitest';
import { packItemsOfRows } from './pack';

const row = (over: Record<string, unknown> = {}) => ({
  id: 'id',
  country_code: 'JO',
  key: 'registration.sole.body',
  value: {
    name: { ar: 'تسجيل مؤسسة فردية', en: 'Sole proprietorship registration' },
    description: { ar: 'وصف.', en: 'A description.' },
  },
  source_url: 'https://example.invalid/jo/registration',
  source_domain: 'example.invalid',
  last_verified: '2026-10-01',
  status: 'verified',
  created_at: '2026-10-01T00:00:00Z',
  updated_at: '2026-10-01T00:00:00Z',
  ...over,
});

describe('packItemsOfRows', () => {
  it('reads a row into the item the legal path takes', () => {
    const { items, skipped } = packItemsOfRows([row()]);
    expect(skipped).toBe(0);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      countryCode: 'JO',
      key: 'registration.sole.body',
      sourceUrl: 'https://example.invalid/jo/registration',
      lastVerified: '2026-10-01',
      status: 'verified',
    });
  });

  it('skips a row that fails the schema and counts it', () => {
    const rows = [
      row(),
      row({ source_url: 'http://example.invalid/not-https' }),
      row({ value: { name: 'not a pair' } }),
      row({ status: 'invented' }),
      row({ last_verified: 'yesterday' }),
    ];
    const { items, skipped } = packItemsOfRows(rows);
    expect(items).toHaveLength(1);
    expect(skipped).toBe(4);
  });

  it('is empty for no rows', () => {
    expect(packItemsOfRows([])).toEqual({ items: [], skipped: 0 });
  });
});
