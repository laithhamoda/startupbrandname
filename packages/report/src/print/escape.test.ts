import { describe, expect, it } from 'vitest';
import { escapeHtml } from './escape';

describe('escapeHtml', () => {
  it('escapes all five characters that can open or close markup', () => {
    expect(escapeHtml(`&<>"'`)).toBe('&amp;&lt;&gt;&quot;&#39;');
  });

  it('escapes the ampersand first, so an entity in the text is shown as written', () => {
    expect(escapeHtml('&lt;')).toBe('&amp;lt;');
  });

  it('turns a hostile tag into text that no parser can read as a tag', () => {
    const escaped = escapeHtml('<img src="http://example.invalid/x" onerror="alert(1)">');
    expect(escaped).not.toMatch(/[<>"]/);
    expect(escaped).toBe(
      '&lt;img src=&quot;http://example.invalid/x&quot; onerror=&quot;alert(1)&quot;&gt;',
    );
  });

  it('leaves Arabic, Latin, digits and tashkeel untouched', () => {
    const text = 'الشَّرِكَةُ 250 د.أ LTV/CAC';
    expect(escapeHtml(text)).toBe(text);
  });

  it('returns an empty string for an empty string', () => {
    expect(escapeHtml('')).toBe('');
  });
});
