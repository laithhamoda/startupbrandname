import { randomBytes } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  BUDGETS,
  checkBudgets,
  gzipBytes,
  parseClientManifest,
  routeChunks,
} from './check-bundle-budget.mjs';

describe('routeChunks', () => {
  it('adds the chunks of every layout, page and boundary to the shared ones, once each', () => {
    const manifest = {
      entryJSFiles: {
        '[project]/apps/web/src/app/[locale]/layout': ['static/chunks/b.js', 'static/chunks/c.js'],
        '[project]/apps/web/src/app/[locale]/error': ['static/chunks/c.js', 'static/chunks/d.js'],
      },
    };

    expect(routeChunks(['static/chunks/a.js', 'static/chunks/b.js'], manifest)).toEqual([
      'static/chunks/a.js',
      'static/chunks/b.js',
      'static/chunks/c.js',
      'static/chunks/d.js',
    ]);
  });

  it('counts JavaScript only, and works without route entries', () => {
    expect(routeChunks(['static/chunks/a.js', 'static/css/a.css'], {})).toEqual([
      'static/chunks/a.js',
    ]);
  });
});

describe('parseClientManifest', () => {
  const source = [
    'globalThis.__RSC_MANIFEST = (globalThis.__RSC_MANIFEST || {});',
    'globalThis.__RSC_MANIFEST["/[locale]/(site)/page"] = {"entryJSFiles":{"x":["a.js"]}};',
  ].join('\n');

  it('reads the manifest of the route entry from its script', () => {
    expect(parseClientManifest(source, '[locale]/(site)/page')).toEqual({
      entryJSFiles: { x: ['a.js'] },
    });
  });

  it('fails when the script holds another entry', () => {
    expect(() => parseClientManifest(source, '[locale]/(site)/signup/page')).toThrow(
      'No client reference manifest for /[locale]/(site)/signup/page.',
    );
  });
});

describe('gzipBytes', () => {
  it('measures what a compressing server sends', () => {
    expect(gzipBytes(Buffer.from('a'.repeat(10_000)))).toBeLessThan(100);
    expect(gzipBytes(randomBytes(1_000))).toBeGreaterThan(1_000);
  });
});

describe('checkBudgets', () => {
  const budgets = { '/a': { entry: 'a', gzipBytes: 100 }, '/b': { entry: 'b', gzipBytes: 50 } };

  it('passes routes at or under their budget', () => {
    expect(checkBudgets({ '/a': 100, '/b': 1 }, budgets)).toEqual([]);
  });

  it('names a route over its budget, and one that was not measured', () => {
    expect(checkBudgets({ '/a': 101 }, budgets)).toEqual([
      '/a: 101 B of JavaScript (gzip), over its budget of 100 B.',
      '/b: not measured.',
    ]);
  });
});

describe('BUDGETS', () => {
  it('covers the home page, signup, onboarding and the diagnostic step (PERF-5)', () => {
    expect(Object.keys(BUDGETS)).toEqual([
      '/[locale]',
      '/[locale]/signup',
      '/[locale]/onboarding',
      '/[locale]/projects/[id]/q/[step]',
    ]);
  });

  it('sets a real budget for every route', () => {
    for (const { gzipBytes: budget } of Object.values(BUDGETS)) {
      expect(budget).toBeGreaterThan(100_000);
    }
  });
});
