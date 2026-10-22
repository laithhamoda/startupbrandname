import { describe, expect, it } from 'vitest';
import type { ReportModel } from '../model/types';
import { modelOf } from '../testing/model-helpers';
import { PRINT_TEMPLATE_VERSION, canonicalJson, reportCacheKey } from './cache-key';

describe('canonicalJson', () => {
  it('writes the keys of an object in order, at every depth', () => {
    expect(canonicalJson({ b: 1, a: { d: [1, { z: 1, y: 2 }], c: null } })).toBe(
      '{"a":{"c":null,"d":[1,{"y":2,"z":1}]},"b":1}',
    );
    expect(canonicalJson({ a: 1, b: 2 })).toBe(canonicalJson({ b: 2, a: 1 }));
  });

  it('leaves an undefined property out and writes an undefined item as null', () => {
    expect(canonicalJson({ a: undefined, b: 1 })).toBe('{"b":1}');
    expect(canonicalJson([undefined, 'x'])).toBe('[null,"x"]');
    expect(canonicalJson(undefined)).toBe('null');
  });

  it('writes strings, numbers and booleans as JSON does', () => {
    expect(canonicalJson('a"b')).toBe('"a\\"b"');
    expect(canonicalJson(1.5)).toBe('1.5');
    expect(canonicalJson(true)).toBe('true');
  });
});

describe('reportCacheKey', () => {
  const model = modelOf('jo-service-subscription', 'ar');

  it('is a sha256 in hex, the same for the same model, even rebuilt', () => {
    const key = reportCacheKey(model);
    expect(key).toMatch(/^[0-9a-f]{64}$/);
    expect(reportCacheKey(modelOf('jo-service-subscription', 'ar'))).toBe(key);
    expect(reportCacheKey(JSON.parse(JSON.stringify(model)) as ReportModel)).toBe(key);
  });

  it('does not depend on the order of the keys', () => {
    const shuffled = Object.fromEntries(Object.entries(model).reverse()) as unknown as ReportModel;
    expect(reportCacheKey(shuffled)).toBe(reportCacheKey(model));
  });

  it('changes when one number changes', () => {
    const text = JSON.stringify(model);
    const changed = JSON.parse(text.replace('"18,400.000"', '"18,400.001"')) as ReportModel;
    expect(JSON.stringify(changed)).not.toBe(text);
    expect(reportCacheKey(changed)).not.toBe(reportCacheKey(model));
  });

  it('changes with the language, the day and the kind of report', () => {
    const keys = new Set([
      reportCacheKey(model),
      reportCacheKey(modelOf('jo-service-subscription', 'en')),
      reportCacheKey(modelOf('jo-service-subscription', 'ar', { today: '2026-10-13' })),
      reportCacheKey(modelOf('jo-service-subscription', 'ar', { kind: 'summary' })),
    ]);
    expect(keys.size).toBe(4);
  });

  it('changes with the version of the template', () => {
    expect(PRINT_TEMPLATE_VERSION).toBeGreaterThan(0);
    expect(reportCacheKey(model, PRINT_TEMPLATE_VERSION)).toBe(reportCacheKey(model));
    expect(reportCacheKey(model, PRINT_TEMPLATE_VERSION + 1)).not.toBe(reportCacheKey(model));
  });
});
