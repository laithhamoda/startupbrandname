import { describe, expect, it } from 'vitest';
import { PUBLIC_PAGES } from './public-pages';
import { hiddenPricingRedirect, pricingPublic, visiblePublicPages } from './pricing-visibility';

describe('pricingPublic (D-341)', () => {
  it('is off unless the variable is exactly "true"', () => {
    expect(pricingPublic({})).toBe(false);
    expect(pricingPublic({ PRICING_PUBLIC: 'false' })).toBe(false);
    expect(pricingPublic({ PRICING_PUBLIC: '1' })).toBe(false);
    expect(pricingPublic({ PRICING_PUBLIC: 'true' })).toBe(true);
  });
});

describe('visiblePublicPages', () => {
  it('drops only the pricing page while it is hidden', () => {
    const hidden = visiblePublicPages(false).map((page) => page.id);
    expect(hidden).not.toContain('pricing');
    expect(hidden).toHaveLength(PUBLIC_PAGES.length - 1);
  });

  it('keeps the whole list once the pricing page is open', () => {
    expect(visiblePublicPages(true)).toEqual(PUBLIC_PAGES);
  });
});

describe('hiddenPricingRedirect', () => {
  it('sends the pricing address of either language to that language home page', () => {
    expect(hiddenPricingRedirect('/ar/pricing', false)).toBe('/ar');
    expect(hiddenPricingRedirect('/en/pricing', false)).toBe('/en');
    expect(hiddenPricingRedirect('/ar/pricing/x', false)).toBe('/ar');
  });

  it('leaves everything else alone, and everything once the page is open', () => {
    expect(hiddenPricingRedirect('/ar/pricing', true)).toBeNull();
    expect(hiddenPricingRedirect('/ar/faq', false)).toBeNull();
    expect(hiddenPricingRedirect('/ar/pricingx', false)).toBeNull();
    expect(hiddenPricingRedirect('/ar/projects/abc/pricing', false)).toBeNull();
    expect(hiddenPricingRedirect('/checkout/strategist', false)).toBeNull();
  });
});
