'use client';

import { Analytics } from '@vercel/analytics/next';
import { withoutQuery } from '@/lib/analytics';

/** Cookieless page-view counts (Vercel Web Analytics, D-092). */
export function SiteAnalytics() {
  return <Analytics beforeSend={withoutQuery} />;
}
