import type { MetadataRoute } from 'next';
import { site } from '@/config/site';
import { routing } from '@/i18n/routing';
import type { LocalizedPath } from '@/seo/alternates';

// Public, indexable pages only. Grows with milestone M2b (docs/DECISIONS.md D-054).
const PAGES: readonly { path: LocalizedPath; priority: number }[] = [{ path: '', priority: 1 }];

export default function sitemap(): MetadataRoute.Sitemap {
  return PAGES.flatMap(({ path, priority }) => {
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
