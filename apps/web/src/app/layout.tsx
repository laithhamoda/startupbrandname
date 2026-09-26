import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Providers } from '@/components/providers';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import { themeScript } from '@/components/theme-script';
import { site } from '@/config/site';
import { isIndexable } from '@/seo/indexing';
import { JsonLd, organizationJsonLd, websiteJsonLd } from '@/seo/json-ld';
import { cairo, tajawal } from './fonts';
import './globals.css';

export function generateMetadata(): Metadata {
  const title = `${site.name} | ${site.descriptor}`;
  return {
    metadataBase: new URL(site.origin),
    title: { default: title, template: `%s | ${site.name}` },
    description: site.description,
    applicationName: site.name,
    openGraph: {
      type: 'website',
      siteName: site.name,
      locale: site.locale,
      title,
      description: site.description,
    },
    robots: isIndexable() ? { index: true, follow: true } : { index: false, follow: false },
  };
}

export const viewport: Viewport = {
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#faf9f6' },
    { media: '(prefers-color-scheme: dark)', color: '#000000' },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html
      lang="ar"
      dir="rtl"
      className={`${cairo.variable} ${tajawal.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* Applies a saved light/dark choice before first paint (D-052). */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="flex min-h-dvh flex-col">
        <Providers>
          <a href="#main" className="skip-link">
            تخطَّ إلى المحتوى
          </a>
          <SiteHeader />
          <main id="main" tabIndex={-1} className="flex-1 focus:outline-none">
            {children}
          </main>
          <SiteFooter />
        </Providers>
        <JsonLd data={organizationJsonLd()} />
        <JsonLd data={websiteJsonLd()} />
      </body>
    </html>
  );
}
