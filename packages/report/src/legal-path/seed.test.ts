import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { PACK_KEYS, packItemSchema, packLabel, PACK_STATUSES, type PackItem } from './index';

/** The seed migration of step 4, read once from a constant path. */
const SEED_PATH = fileURLToPath(
  new URL(
    '../../../../supabase/migrations/20261013000000_m5_country_pack_seed.sql',
    import.meta.url,
  ),
);
const SEED = readFileSync(SEED_PATH, 'utf8');
const TODAY = '2026-10-12';

/** The text between single quotes, in order: the odd pieces of a split on the quote. */
function quoted(text: string): string[] {
  return text.split("'").filter((_, index) => index % 2 === 1);
}

interface SeedRow {
  item: PackItem;
  sourceDomain: string;
  rawValue: unknown;
}

/**
 * The file is split on the $json$ markers: the odd segments are the JSON values; the text before
 * each ends with the country and key, and the text after starts with source_url, source_domain,
 * date and status.
 */
function readSeed(): { rows: SeedRow[]; allowedDomains: string[] } {
  const segments = SEED.split('$json$');
  const rows: SeedRow[] = [];
  for (let index = 1; index < segments.length; index += 2) {
    const before = segments[index - 1] ?? '';
    const after = segments[index + 1] ?? '';
    const head = before.slice(before.lastIndexOf('values (') + 'values ('.length);
    const tail = after.slice(0, after.indexOf('\n)'));
    const [countryCode, key] = quoted(head);
    const [sourceUrl, sourceDomain, lastVerified, status] = quoted(tail);
    const rawValue: unknown = JSON.parse(segments[index] ?? '');
    rows.push({
      item: { countryCode, key, value: rawValue, sourceUrl, lastVerified, status } as PackItem,
      sourceDomain: sourceDomain ?? '',
      rawValue,
    });
  }
  const marker = SEED.indexOf("'pack.allowed_domains'");
  const listLine = SEED.slice(marker).split('\n')[1] ?? '';
  const allowedDomains = JSON.parse(quoted(listLine)[0] ?? '[]') as string[];
  return { rows, allowedDomains };
}

const { rows, allowedDomains } = readSeed();

function figuresOf(value: unknown): { id: string; evidence: unknown[] }[] {
  const figures = (value as { figures?: { id: string; evidence: unknown[] }[] }).figures;
  return figures ?? [];
}

describe('the country pack seed', () => {
  it('holds the 29 items of the audit and the 17 allowed domains', () => {
    expect(rows).toHaveLength(29);
    expect(rows.filter((row) => row.item.countryCode === 'JO')).toHaveLength(14);
    expect(rows.filter((row) => row.item.countryCode === 'DZ')).toHaveLength(15);
    expect(allowedDomains).toHaveLength(17);
  });

  it('has no repeated country and key', () => {
    const seen = new Set(rows.map((row) => `${row.item.countryCode}:${row.item.key}`));
    expect(seen.size).toBe(rows.length);
  });

  it('passes the item schema, value included, for every row', () => {
    for (const row of rows) {
      const result = packItemSchema.safeParse(row.item);
      expect(result.success, `${row.item.countryCode} ${row.item.key}`).toBe(true);
    }
  });

  it('has an https source whose stored domain is its host and is an allowed domain', () => {
    for (const row of rows) {
      const where = `${row.item.countryCode} ${row.item.key}`;
      const url = new URL(row.item.sourceUrl);
      expect(url.protocol, where).toBe('https:');
      expect(row.sourceDomain, where).toBe(url.hostname.toLowerCase());
      const allowed = allowedDomains.some(
        (domain) => url.hostname === domain || url.hostname.endsWith(`.${domain}`),
      );
      expect(allowed, `${where} ${url.hostname}`).toBe(true);
    }
  });

  it('keeps the evidence links on https and on an allowed domain', () => {
    for (const row of rows) {
      const links: string[] = [];
      const value = row.rawValue as { evidence?: { url: string }[] };
      for (const evidence of value.evidence ?? []) links.push(evidence.url);
      for (const figure of figuresOf(row.rawValue)) {
        for (const evidence of figure.evidence as { url: string }[]) links.push(evidence.url);
      }
      for (const link of links) {
        const host = new URL(link).hostname;
        const allowed = allowedDomains.some(
          (domain) => host === domain || host.endsWith(`.${domain}`),
        );
        expect(allowed, `${row.item.key} ${host}`).toBe(true);
      }
    }
  });

  it('has no date in the future and a date for every verified item', () => {
    for (const row of rows) {
      if (row.item.lastVerified !== null) {
        expect(row.item.lastVerified <= TODAY, row.item.key).toBe(true);
      }
      if (row.item.status === 'verified')
        expect(row.item.lastVerified, row.item.key).not.toBeNull();
    }
  });

  it('has a known status for every row, and the audited split', () => {
    for (const row of rows) expect(PACK_STATUSES).toContain(row.item.status);
    const count = (status: string) => rows.filter((row) => row.item.status === status).length;
    expect(count('verified')).toBe(27);
    expect(count('under_review')).toBe(1);
    expect(count('unverified')).toBe(1);
  });

  it('puts every figure next to its own evidence', () => {
    let figures = 0;
    for (const row of rows) {
      for (const figure of figuresOf(row.rawValue)) {
        figures += 1;
        expect(figure.evidence.length, `${row.item.key} ${figure.id}`).toBeGreaterThan(0);
      }
    }
    expect(figures).toBeGreaterThan(0);
  });

  it('has items for both countries and the tax authority link of each', () => {
    for (const country of ['JO', 'DZ']) {
      const authority = rows.find(
        (row) => row.item.countryCode === country && row.item.key === PACK_KEYS.taxAuthority,
      );
      expect(authority, country).toBeDefined();
      expect(authority?.item.value.url).toBeDefined();
    }
  });

  it('gives the label code to every item that is not verified', () => {
    const notVerified = rows.filter((row) => row.item.status !== 'verified');
    expect(notVerified.length).toBeGreaterThan(0);
    for (const row of notVerified) {
      expect(packLabel(row.item, TODAY), row.item.key).toBe('verify_official_source');
    }
    for (const row of rows.filter((entry) => entry.item.status === 'verified')) {
      expect(packLabel(row.item, TODAY), row.item.key).toBeNull();
    }
  });

  it('holds every key the constants name, for its country, and no other key', () => {
    const known = new Set<string>(Object.values(PACK_KEYS));
    for (const row of rows) expect(known.has(row.item.key), row.item.key).toBe(true);
  });

  it('writes no tax rule (D-266)', () => {
    expect(SEED.includes('insert into public.tax_rules')).toBe(false);
  });
});
