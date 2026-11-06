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
    // Stated here, because CI builds with the pricing page public (D-341).
    vi.stubEnv('PRICING_PUBLIC', 'false');
    try {
      const hidden = llmsTxt();
      for (const { id, path } of PUBLIC_PAGES) {
        const arabic = `(https://startupbrandname.com/ar${path})`;
        if (id === 'pricing') expect(hidden).not.toContain(arabic);
        else expect(hidden).toContain(arabic);
        expect(hidden).not.toContain(`(https://startupbrandname.com/en${path})`);
      }
      expect(hidden).toContain('(https://startupbrandname.com/ai-context)');
    } finally {
      vi.unstubAllEnvs();
    }
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

  it('quotes the plan prices from the plan table once the pricing page is open', () => {
    vi.stubEnv('PRICING_PUBLIC', 'true');
    try {
      const open = llmsTxt();
      expect(open).toContain('Strategist $10 (40 questions');
      expect(open).toContain('Commander $30 (all 64 questions');
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('writes no price while the pricing page is hidden (D-341, D-342)', () => {
    vi.stubEnv('PRICING_PUBLIC', 'false');
    try {
      const hidden = llmsTxt();
      expect(hidden).not.toMatch(/\$\d/);
      expect(hidden).toContain('Explorer is free');
      expect(hidden).toContain('with their prices when the free launch window ends');
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('never links a private page', () => {
    expect(text).not.toMatch(/\/(projects|account|onboarding|design)\b/);
  });
});
