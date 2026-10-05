import type { MetadataRoute } from 'next';
import { isIndexable } from '@/seo/indexing';
import { robotsRules } from '@/seo/robots';

export default function robots(): MetadataRoute.Robots {
  return robotsRules(isIndexable());
}
