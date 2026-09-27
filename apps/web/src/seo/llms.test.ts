import { describe, expect, it } from 'vitest';
import { PUBLIC_PAGES } from '@/config/public-pages';
import { llmsTxt } from './llms';

describe('llms.txt', () => {
  const text = llmsTxt();

  it('starts with the site name and a summary quote (llmstxt.org format)', () => {
    expect(text).toMatch(/^# Startup Brand Name\n\n> /);
  });

  it('links every public page in both languages', () => {
    for (const { path } of PUBLIC_PAGES) {
      expect(text).toContain(`(https://startupbrandname.com/en${path})`);
      expect(text).toContain(`(https://startupbrandname.com/ar${path})`);
    }
  });

  it('quotes the plan prices from the plan table', () => {
    expect(text).toContain('Weekly $5 (7 days); Monthly $17; Annual $150 (365 days)');
  });

  it('never links a private page', () => {
    expect(text).not.toMatch(/\/(projects|account|onboarding|design)\b/);
  });
});
