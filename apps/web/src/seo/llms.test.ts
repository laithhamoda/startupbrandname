import { describe, expect, it, vi } from 'vitest';
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

  it('links every public page in Arabic, except pricing while it is hidden, and the AI context page (D-336, D-337, D-341)', () => {
    for (const { id, path } of PUBLIC_PAGES) {
      const arabic = `(https://startupbrandname.com/ar${path})`;
      if (id === 'pricing') expect(text).not.toContain(arabic);
      else expect(text).toContain(arabic);
      expect(text).not.toContain(`(https://startupbrandname.com/en${path})`);
    }
    expect(text).toContain('(https://startupbrandname.com/ai-context)');
  });

  it('lists the pricing page once it is open', () => {
    vi.stubEnv('PRICING_PUBLIC', 'true');
    try {
      expect(llmsTxt()).toContain('(https://startupbrandname.com/ar/pricing)');
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('does not claim an English interface or mention the unpublished mentor (D-339)', () => {
    expect(text).toContain('Interface in Arabic only');
    expect(text).not.toMatch(/mentor/i);
  });

  it('quotes the plan prices from the plan table', () => {
    expect(text).toContain('Strategist $10 (40 questions');
    expect(text).toContain('Commander $30 (all 64 questions');
  });

  it('never links a private page', () => {
    expect(text).not.toMatch(/\/(projects|account|onboarding|design)\b/);
  });
});
