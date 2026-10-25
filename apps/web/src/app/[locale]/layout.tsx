import type { Metadata, Viewport } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { Providers } from '@/components/providers';
import { SiteAnalytics } from '@/components/site-analytics';
import { themeScript } from '@/components/theme-script';
import { site } from '@/config/site';
import { getServerEnv } from '@/env/server';
import { ROOT_NAMESPACES, pickMessages } from '@/i18n/client-messages';
import { currentLocale } from '@/i18n/locale';
import { DIRECTION, routing } from '@/i18n/routing';
import { crawlerPolicy, type CrawlerPolicy } from '@/seo/indexing';
import { JsonLd, organizationJsonLd, websiteJsonLd } from '@/seo/json-ld';
import { openGraphBase } from '@/seo/page-metadata';
import { countVisits } from '@/lib/analytics';
import { FONT_VARIABLES } from '../fonts';
import '../globals.css';

const ROBOTS_META: Record<CrawlerPolicy, Metadata['robots']> = {
  closed: { index: false, follow: false },
  'ai-only': undefined,
  open: { index: true, follow: true },
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}
export async function generateMetadata(): Promise<Metadata> {
  const locale = await currentLocale();
  const t = await getTranslations('meta');
  // The category, not the tagline, follows the name in the home title: the name alone reads as a
  // name generator (D-305). The tagline stays in the header.
  const title = `${site.name} | ${t('category')}`;
  return {
    metadataBase: new URL(site.origin),
    title: { default: title, template: `%s | ${site.name}` },
    description: t('description'),
    applicationName: site.name,
    // The ICO says 32x32 on purpose: a browser that reads SVG then picks icon.svg, and the rest
    // take the ICO. Files are in public/ and come from scripts/brand (D-289).
    icons: {
      icon: [
        { url: '/favicon.ico', sizes: '32x32' },
        { url: '/icon.svg', type: 'image/svg+xml' },
      ],
      apple: { url: '/apple-touch-icon.png', sizes: '180x180' },
    },
    manifest: '/manifest.webmanifest',
    openGraph: { ...openGraphBase(locale), title, description: t('description') },
    // In `ai-only` no robots tag is written: a noindex tag would tell the AI crawlers to skip the
    // pages too, and robots.txt already keeps the search engines out (D-303).
    robots: ROBOTS_META[crawlerPolicy()],
  };
}

export const viewport: Viewport = {
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#faf9f6' },
    { media: '(prefers-color-scheme: dark)', color: '#000000' },
  ],
};

/** Root layout: <html lang dir> follows the [locale] segment, Arabic RTL or English LTR (D-067). */
export default async function LocaleLayout({ children }: Readonly<{ children: ReactNode }>) {
  const locale = await currentLocale();
  const t = await getTranslations('common');
  const meta = await getTranslations('meta');

  return (
    <html lang={locale} dir={DIRECTION[locale]} className={FONT_VARIABLES} suppressHydrationWarning>
      <head>
        {/* Applies a saved light/dark choice before first paint (D-052). */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="flex min-h-dvh flex-col">
        {/* Only what every page's client components read; pages add theirs (ClientMessages). */}
        <NextIntlClientProvider messages={pickMessages(await getMessages(), ROOT_NAMESPACES)}>
          <Providers dir={DIRECTION[locale]}>
            <a href="#main" className="skip-link">
              {t('skipToContent')}
            </a>
            {children}
          </Providers>
        </NextIntlClientProvider>
        <JsonLd data={organizationJsonLd(meta('descriptor'), meta('description'))} />
        <JsonLd data={websiteJsonLd(meta('descriptor'))} />
        {countVisits(getServerEnv()) ? <SiteAnalytics /> : null}
      </body>
    </html>
  );
}
