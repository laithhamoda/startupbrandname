/**
 * The site is Arabic only (D-336). English stays for the privacy policy and the terms, which the
 * payment provider and GDPR readers need; every other /en address goes to its /ar page. The English
 * message files stay in the code, so turning English back on is a change here, not a rewrite.
 */
const ENGLISH_PAGES = ['/privacy', '/terms'] as const;

/** Whether this path (after the language prefix, such as '/privacy') has an English version. */
export function hasEnglishVersion(path: string): boolean {
  return ENGLISH_PAGES.some((page) => path === page || path.startsWith(`${page}/`));
}

/** The /ar address for an /en address that has no English version, else null. */
export function arabicRedirect(pathname: string): string | null {
  if (pathname !== '/en' && !pathname.startsWith('/en/')) return null;
  const rest = pathname.slice('/en'.length);
  return hasEnglishVersion(rest) ? null : `/ar${rest}`;
}
