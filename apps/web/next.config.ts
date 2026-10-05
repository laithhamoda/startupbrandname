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
  transpilePackages: ['@sbn/ai', '@sbn/question-bank'],
  headers: () =>
    Promise.resolve([
      { source: '/:path*', headers: SECURITY_HEADERS },
      ...(indexable
        ? []
        : [{ source: '/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] }]),
    ]),
};

export default withNextIntl(nextConfig);
