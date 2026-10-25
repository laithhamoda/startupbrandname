import type { MetadataRoute } from 'next';
import { crawlerPolicy } from '@/seo/indexing';
import { robotsRules } from '@/seo/robots';

export default function robots(): MetadataRoute.Robots {
  return robotsRules(crawlerPolicy());
}
