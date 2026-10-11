import { describe, expect, it } from 'vitest';
import { buildSpikeFixture } from './spike';

describe('the spike fixture with the real fonts', () => {
  it('inlines the print fonts when none are given, and nothing else is fetched', async () => {
    for (const locale of ['ar', 'en'] as const) {
      const { html } = await buildSpikeFixture(locale);
      expect(html.match(/@font-face/g)).toHaveLength(10);
      expect(html).not.toMatch(/url\((?!data:)/);
      // Two documents of about 170 KB each: the fonts are most of it.
      expect(html.length).toBeGreaterThan(100_000);
    }
  });
});
