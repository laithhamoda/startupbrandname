/**
 * The public, indexable pages (M2b). One list feeds the sitemap, llms.txt, the share images and
 * the Lighthouse checks. Slugs are English in both languages (D-091).
 */
export const PUBLIC_PAGES = [
  { id: 'home', path: '', priority: 1 },
  { id: 'howItWorks', path: '/how-it-works', priority: 0.9 },
  { id: 'methodology', path: '/methodology', priority: 0.8 },
  { id: 'pricing', path: '/pricing', priority: 0.9 },
  { id: 'glossary', path: '/glossary', priority: 0.7 },
  { id: 'faq', path: '/faq', priority: 0.7 },
  { id: 'about', path: '/about', priority: 0.6 },
] as const;

export type PublicPage = (typeof PUBLIC_PAGES)[number];
export type PublicPageId = PublicPage['id'];

export function publicPage(id: PublicPageId): PublicPage {
  const page = PUBLIC_PAGES.find((candidate) => candidate.id === id);
  if (!page) throw new Error(`Unknown public page: ${id}`);
  return page;
}

/** File name of a page's share image under /og/{locale}/. */
export function ogImageName(id: PublicPageId): string {
  return `${publicPage(id).path.slice(1) || 'home'}.png`;
}
