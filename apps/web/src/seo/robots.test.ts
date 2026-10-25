import { describe, expect, it } from 'vitest';
import { AI_CRAWLERS, robotsRules } from './robots';

const PRIVATE = [
  '/api/',
  '/auth/',
  '/ar/projects',
  '/en/projects',
  '/ar/account',
  '/en/onboarding',
  '/ar/design',
];

describe('robots.txt rules', () => {
  it('closes the whole site before launch', () => {
    expect(robotsRules('closed')).toEqual({ rules: { userAgent: '*', disallow: '/' } });
  });

  it('opens public pages to every crawler after launch, AI crawlers included (D-090)', () => {
    const { rules, sitemap } = robotsRules('open');
    expect(rules).toMatchObject({ userAgent: '*', allow: '/' });
    expect(sitemap).toBe('https://startupbrandname.com/sitemap.xml');
  });

  it('keeps private areas closed in both languages', () => {
    const { rules } = robotsRules('open');
    const disallow = Array.isArray(rules) ? [] : rules.disallow;
    for (const path of PRIVATE) expect(disallow).toContain(path);
  });

  describe('ai-only, before public launch (D-303)', () => {
    const rules = robotsRules('ai-only').rules;
    const list = Array.isArray(rules) ? rules : [rules];
    const forAi = list.find((rule) => rule.userAgent !== '*');
    const forEveryoneElse = list.find((rule) => rule.userAgent === '*');

    it('opens the public pages to the named AI crawlers only', () => {
      expect(forAi?.userAgent).toEqual([...AI_CRAWLERS]);
      expect(forAi?.allow).toBe('/');
    });

    it('keeps the private areas closed even to them', () => {
      for (const path of PRIVATE) expect(forAi?.disallow).toContain(path);
    });

    it('keeps every other crawler, the search engines included, out of the whole site', () => {
      expect(forEveryoneElse).toEqual({ userAgent: '*', disallow: '/' });
    });

    it('names the crawlers the owner asked for', () => {
      expect(AI_CRAWLERS).toEqual(
        expect.arrayContaining(['GPTBot', 'ClaudeBot', 'PerplexityBot', 'OAI-SearchBot']),
      );
    });
  });
});
