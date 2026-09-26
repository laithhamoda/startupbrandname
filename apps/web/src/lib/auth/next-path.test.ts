import { describe, expect, it } from 'vitest';
import { localeOfPath, safeNextPath } from './next-path';

describe('safeNextPath', () => {
  it.each(['/ar/projects', '/en/account', '/ar', '/en/projects/abc-123'])('accepts %s', (path) => {
    expect(safeNextPath(path, '/ar/projects')).toBe(path);
  });

  it.each([
    null,
    '',
    'https://evil.example/ar',
    '//evil.example/ar',
    '/ar//evil.example',
    '/fr/projects',
    '/projects',
    '/ar/projects?next=https://evil.example',
    '/ar/\\evil.example',
    'javascript:alert(1)',
  ])('falls back for %j', (path) => {
    expect(safeNextPath(path, '/ar/projects')).toBe('/ar/projects');
  });
});

describe('localeOfPath', () => {
  it('reads the language prefix', () => {
    expect(localeOfPath('/en/projects')).toBe('en');
    expect(localeOfPath('/ar')).toBe('ar');
  });

  it('defaults to Arabic', () => {
    expect(localeOfPath('/fr/projects')).toBe('ar');
  });
});
