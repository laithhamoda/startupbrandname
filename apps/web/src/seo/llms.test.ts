import { describe, expect, it } from 'vitest';
import { PUBLIC_PAGES } from '@/config/public-pages';
import { llmsTxt } from './llms';

describe('llms.txt', () => {
  const text = llmsTxt();

  it('starts with the site name and a summary quote (llmstxt.org format)', () => {
    expect(text).toMatch(/^# Startup Brand Name\n\n> /);
  });

  it('states its category and what it is not, so the name is not misread (D-303)', () => {
    expect(text).toContain('Category: business idea diagnostic and feasibility report.');
    expect(text).toContain('not a business name generator or a domain marketplace');
  });

  it('links every public page in both languages', () => {
    for (const { path } of PUBLIC_PAGES) {
      expect(text).toContain(`(https://startupbrandname.com/en${path})`);
      expect(text).toContain(`(https://startupbrandname.com/ar${path})`);
    }
  });

  it('quotes the plan prices from the plan table', () => {
    expect(text).toContain('Strategist $10 (40 questions');
    expect(text).toContain('Commander $30 (all 64 questions');
  });

  it('never links a private page', () => {
    expect(text).not.toMatch(/\/(projects|account|onboarding|design)\b/);
  });
});
