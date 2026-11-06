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

/**
 * /ai-context (D-337) is one English page for AI assistants, served at this prefix-free address.
 * The proxy rewrites it to the English locale and sends its /ar and /en addresses here.
 */
export const AI_CONTEXT_PATH = '/ai-context';

/** The internal address the proxy serves /ai-context from, else null. */
export function aiContextRewrite(pathname: string): string | null {
  return pathname === AI_CONTEXT_PATH ? `/en${AI_CONTEXT_PATH}` : null;
}

/** /ar/ai-context and /en/ai-context are the same page as /ai-context: one address (308). */
export function aiContextRedirect(pathname: string): string | null {
  return pathname === `/ar${AI_CONTEXT_PATH}` || pathname === `/en${AI_CONTEXT_PATH}`
    ? AI_CONTEXT_PATH
    : null;
}
