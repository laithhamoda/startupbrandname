import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

// Same rule as isIndexable() in src/seo/indexing.ts (that module is server-only, so not importable here).
const indexable = process.env.VERCEL_ENV === 'production' && process.env.SITE_INDEXABLE === 'true';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

// Baseline browser protections on every response (OWASP ASVS V3.4), asserted in
// e2e/quality.spec.ts. The policy only forbids framing (clickjacking of the delete dialogs), so it
// needs no nonce and static pages stay static. HSTS repeats the two years Vercel already sends on
// the custom domain (checked 2026-09-28), so it holds wherever the app runs; includeSubDomains and
// preload affect the whole domain and are left to the owner.
const SECURITY_HEADERS = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Revisit payment= when the PayPal checkout arrives (M7).
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000' },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Workspace packages ship TypeScript source (packages/*/src).
  transpilePackages: ['@sbn/ai', '@sbn/engine', '@sbn/question-bank', '@sbn/report'],
  // The PDF renderer (D-239): Puppeteer and the 60 MB Chromium of @sparticuz/chromium stay outside
  // the bundle, because the browser is unpacked from the package's own bin folder at run time.
  serverExternalPackages: ['puppeteer-core', '@sparticuz/chromium'],
  // What the tracer cannot see, because the code reads it by path: the browser's compressed files
  // and the print fonts. Only the temporary measuring route needs them until step 6 (D-241).
  // Both are listed at their real pnpm path (.pnpm/<name>@<version>/node_modules/<name>), because
  // @sparticuz/chromium finds its bin folder from its own real location (import.meta.url) and the
  // function must carry the files there, not only behind the symlink of apps/web/node_modules
  // (D-239). The browser is listed only once: it is 68 MB. The fonts also keep the symlink path,
  // which the fonts loader walks to when it cannot resolve the package.
  outputFileTracingIncludes: {
    '/api/internal/pdf-spike': [
      '../../node_modules/.pnpm/@sparticuz+chromium@*/node_modules/@sparticuz/chromium/bin/**',
      '../../node_modules/.pnpm/@fontsource+cairo@*/node_modules/@fontsource/cairo/files/cairo-{arabic,latin}-{600,700}-normal.woff2',
      '../../node_modules/.pnpm/@fontsource+tajawal@*/node_modules/@fontsource/tajawal/files/tajawal-{arabic,latin}-{400,500,700}-normal.woff2',
      '../../node_modules/.pnpm/@fontsource+{cairo,tajawal}@*/node_modules/@fontsource/{cairo,tajawal}/package.json',
      './node_modules/@fontsource/cairo/files/cairo-{arabic,latin}-{600,700}-normal.woff2',
      './node_modules/@fontsource/tajawal/files/tajawal-{arabic,latin}-{400,500,700}-normal.woff2',
      './node_modules/@fontsource/{cairo,tajawal}/package.json',
    ],
  },
  headers: () =>
    Promise.resolve([
      { source: '/:path*', headers: SECURITY_HEADERS },
      ...(indexable
        ? []
        : [{ source: '/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] }]),
    ]),
};

export default withNextIntl(nextConfig);
