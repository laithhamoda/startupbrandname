import { describe, expect, it } from 'vitest';
import { localeOfPath, loginPath, safeNextPath } from './next-path';

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

describe('loginPath', () => {
  it('carries the page to come back to', () => {
    expect(loginPath('ar', '/ar/projects/abc-123/q/A7')).toBe(
      '/ar/login?next=%2Far%2Fprojects%2Fabc-123%2Fq%2FA7',
    );
    expect(loginPath('en', '/en/account')).toBe('/en/login?next=%2Fen%2Faccount');
  });

  it('leaves out the projects list, where sign-in goes anyway', () => {
    expect(loginPath('ar', '/ar/projects')).toBe('/ar/login');
    expect(loginPath('en', null)).toBe('/en/login');
  });

  it.each(['https://evil.example/ar', '//evil.example/ar', '/ar//evil.example', '/projects'])(
    'never carries %j',
    (from) => {
      expect(loginPath('ar', from)).toBe('/ar/login');
    },
  );
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
