import type { MetadataRoute } from 'next';
import { PUBLIC_PAGES } from '@/config/public-pages';
import { site } from '@/config/site';
import { hasEnglishVersion } from '@/i18n/arabic-only';
import { routing } from '@/i18n/routing';

// Public, indexable pages only, each with its other-language version (D-054, M2b).
export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_PAGES.flatMap(({ path, priority }) => {
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
}
