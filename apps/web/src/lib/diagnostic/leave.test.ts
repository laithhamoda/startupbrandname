import { describe, expect, it } from 'vitest';
import { type LinkClick, type LinkTarget, leavesPage, sameDraft } from './leave';

describe('sameDraft', () => {
  it('compares text, choices and lists by value', () => {
    expect(sameDraft('إربد', 'إربد')).toBe(true);
    expect(sameDraft('إربد', 'عمّان')).toBe(false);
    expect(sameDraft(null, null)).toBe(true);
    expect(sameDraft(null, false)).toBe(false);
    expect(sameDraft({ amount: '250', currency: 'JOD' }, { currency: 'JOD', amount: '250' })).toBe(
      true,
    );
    expect(sameDraft({ amount: '250', currency: 'JOD' }, { amount: '250', currency: '' })).toBe(
      false,
    );
    expect(
      sameDraft(
        { items: [{ name: 'a', url: '' }], other: '' },
        { items: [{ name: 'a', url: '' }], other: '' },
      ),
    ).toBe(true);
  });

  it('sees an added, removed or reordered list item', () => {
    expect(sameDraft({ values: ['a'] }, { values: ['a', 'b'] })).toBe(false);
    expect(sameDraft({ values: ['a', 'b'] }, { values: ['b', 'a'] })).toBe(false);
    expect(sameDraft({ peakMonths: [] }, { peakMonths: {} })).toBe(false);
    expect(sameDraft({ a: 1 }, { a: 1, b: undefined })).toBe(false);
  });
});

describe('leavesPage', () => {
  const here = 'https://startupbrandname.com/ar/projects/abc-123/q/A7';
  const click: LinkClick = {
    button: 0,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    defaultPrevented: false,
  };
  const link = (href: string, extra: Partial<LinkTarget> = {}): LinkTarget => ({
    href: new URL(href, here).href,
    target: '',
    download: false,
    ...extra,
  });

  it.each([
    ['Previous', '/ar/projects/abc-123/q/A6'],
    ['the overview', '/ar/projects/abc-123'],
    ['the language switch', '/en/projects/abc-123/q/A7'],
    ['a header link', '/ar/account'],
  ])('asks before %s', (_name, href) => {
    expect(leavesPage(click, link(href), here)).toBe(true);
  });

  it('lets through what does not leave this tab or this page', () => {
    expect(leavesPage({ ...click, ctrlKey: true }, link('/ar/account'), here)).toBe(false);
    expect(leavesPage({ ...click, metaKey: true }, link('/ar/account'), here)).toBe(false);
    expect(leavesPage({ ...click, shiftKey: true }, link('/ar/account'), here)).toBe(false);
    expect(leavesPage({ ...click, button: 1 }, link('/ar/account'), here)).toBe(false);
    expect(leavesPage(click, link('/ar/account', { target: '_blank' }), here)).toBe(false);
    expect(leavesPage(click, link('/ar/terms.pdf', { download: true }), here)).toBe(false);
    expect(leavesPage(click, link('#main'), here)).toBe(false);
    expect(leavesPage({ ...click, defaultPrevented: true }, link('/ar/account'), here)).toBe(false);
  });

  it('leaves another site to the browser prompt', () => {
    expect(leavesPage(click, link('https://example.com/ar'), here)).toBe(false);
  });
});
