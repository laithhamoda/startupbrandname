import type { MetadataRoute } from 'next';
import { site } from '@/config/site';

// Public pages only. Grows with milestone M2b (docs/DECISIONS.md D-054).
export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: `${site.origin}/`, changeFrequency: 'weekly', priority: 1 }];
}
