import type { MetadataRoute } from 'next';
import { site } from '@/config/site';
import { routing } from '@/i18n/routing';
import { isIndexable } from '@/seo/indexing';

export default function robots(): MetadataRoute.Robots {
  if (!isIndexable()) {
    return { rules: { userAgent: '*', disallow: '/' } };
  }
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/auth/', ...routing.locales.map((locale) => `/${locale}/design`)],
    },
    sitemap: `${site.origin}/sitemap.xml`,
    host: site.origin,
  };
}
