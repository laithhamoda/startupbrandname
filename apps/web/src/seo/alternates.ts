import type { Metadata } from 'next';
import { type Locale, routing } from '@/i18n/routing';

/** A path after the language prefix: '' for the home page, otherwise '/privacy' and so on. */
export type LocalizedPath = '' | `/${string}`;

/**
 * Canonical URL plus hreflang links to every language version. `x-default` is the path without a
 * prefix, which redirects each visitor to their language (D-070).
 */
export function localizedAlternates(locale: Locale, path: LocalizedPath): Metadata['alternates'] {
  const languages: Record<string, string> = {};
  for (const other of routing.locales) languages[other] = `/${other}${path}`;
  languages['x-default'] = path === '' ? '/' : path;
  return { canonical: `/${locale}${path}`, languages };
}
