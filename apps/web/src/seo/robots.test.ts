import { describe, expect, it } from 'vitest';
import { robotsRules } from './robots';

describe('robots.txt rules', () => {
  it('closes the whole site before launch', () => {
    expect(robotsRules(false)).toEqual({ rules: { userAgent: '*', disallow: '/' } });
  });

  it('opens public pages to every crawler after launch, AI crawlers included (D-090)', () => {
    const { rules, sitemap } = robotsRules(true);
    expect(rules).toMatchObject({ userAgent: '*', allow: '/' });
    expect(sitemap).toBe('https://startupbrandname.com/sitemap.xml');
  });

  it('keeps private areas closed in both languages', () => {
    const { rules } = robotsRules(true);
    const disallow = Array.isArray(rules) ? [] : rules.disallow;
    for (const path of [
      '/api/',
      '/auth/',
      '/ar/projects',
      '/en/projects',
      '/ar/account',
      '/en/onboarding',
      '/ar/design',
    ]) {
      expect(disallow).toContain(path);
    }
  });
});
