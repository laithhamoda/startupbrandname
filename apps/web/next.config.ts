import type { NextConfig } from 'next';

// Same rule as isIndexable() in src/seo/indexing.ts (that module is server-only, so not importable here).
const indexable = process.env.VERCEL_ENV === 'production' && process.env.SITE_INDEXABLE === 'true';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  headers: () =>
    Promise.resolve(
      indexable
        ? []
        : [{ source: '/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] }],
    ),
};

export default nextConfig;
