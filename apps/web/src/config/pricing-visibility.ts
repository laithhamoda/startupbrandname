import { PUBLIC_PAGES, type PublicPage } from './public-pages';

/**
 * Whether the pricing page is shown (D-341). While the free launch window runs the page is hidden:
 * no link, no sitemap entry, no mention in llms.txt, and its address goes to the home page. The owner
 * opens it by setting PRICING_PUBLIC=true and redeploying when the window ends. Read from the
 * environment at build and at run time, so the static pages and the proxy agree.
 */
export function pricingPublic(env: Readonly<Record<string, string | undefined>> = process.env) {
  return env.PRICING_PUBLIC === 'true';
}

/** The public pages the site shows today: the whole list, without pricing while it is hidden. */
export function visiblePublicPages(open: boolean = pricingPublic()): readonly PublicPage[] {
  return open ? PUBLIC_PAGES : PUBLIC_PAGES.filter((page) => page.id !== 'pricing');
}

/** Where a hidden pricing address (/ar/pricing, /en/pricing) goes: the home page, else null. */
export function hiddenPricingRedirect(pathname: string, open: boolean): string | null {
  if (open) return null;
  const match = /^\/(ar|en)\/pricing(?:\/.*)?$/.exec(pathname);
  return match ? `/${match[1] ?? 'ar'}` : null;
}
