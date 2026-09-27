import type { MetadataRoute } from 'next';
import { PUBLIC_PAGES } from '@/config/public-pages';
import { site } from '@/config/site';
import { routing } from '@/i18n/routing';

// Public, indexable pages only, each with its other-language version (D-054, M2b).
export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_PAGES.flatMap(({ path, priority }) => {
    const languages = Object.fromEntries(
      routing.locales.map((locale) => [locale, `${site.origin}/${locale}${path}`]),
    );
    return routing.locales.map((locale) => ({
      url: `${site.origin}/${locale}${path}`,
      changeFrequency: 'weekly' as const,
      priority,
      alternates: { languages },
    }));
  });
}
