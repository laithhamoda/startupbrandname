import type { MetadataRoute } from 'next';
import { visiblePublicPages } from '@/config/pricing-visibility';
import { site } from '@/config/site';
import { AI_CONTEXT_PATH, hasEnglishVersion } from '@/i18n/arabic-only';
import { routing } from '@/i18n/routing';

// Public, indexable pages only, each with its other-language version (D-054, M2b).
export default function sitemap(): MetadataRoute.Sitemap {
  const pages = visiblePublicPages().flatMap(({ path, priority }) => {
    const locales = routing.locales.filter((locale) => locale === 'ar' || hasEnglishVersion(path));
    const languages = Object.fromEntries(
      locales.map((locale) => [locale, `${site.origin}/${locale}${path}`]),
    );
    return locales.map((locale) => ({
      url: `${site.origin}/${locale}${path}`,
      changeFrequency: 'weekly' as const,
      priority,
      alternates: { languages },
    }));
  });
  // The English page for AI assistants, at its own prefix-free address (D-337).
  return [
    ...pages,
    {
      url: `${site.origin}${AI_CONTEXT_PATH}`,
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    },
  ];
}
