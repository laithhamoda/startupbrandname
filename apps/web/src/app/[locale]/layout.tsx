import type { Metadata, Viewport } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { Providers } from '@/components/providers';
import { themeScript } from '@/components/theme-script';
import { site } from '@/config/site';
import { currentLocale } from '@/i18n/locale';
import { DIRECTION, OG_LOCALE, routing } from '@/i18n/routing';
import { isIndexable } from '@/seo/indexing';
import { JsonLd, organizationJsonLd, websiteJsonLd } from '@/seo/json-ld';
import { cairo, tajawal } from '../fonts';
import '../globals.css';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}
export async function generateMetadata(): Promise<Metadata> {
  const locale = await currentLocale();
  const t = await getTranslations('meta');
  const title = `${site.name} | ${t('descriptor')}`;
  return {
    metadataBase: new URL(site.origin),
    title: { default: title, template: `%s | ${site.name}` },
    description: t('description'),
    applicationName: site.name,
    openGraph: {
      type: 'website',
      siteName: site.name,
      locale: OG_LOCALE[locale],
      alternateLocale: routing.locales
        .filter((other) => other !== locale)
        .map((other) => OG_LOCALE[other]),
      title,
      description: t('description'),
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

/** Root layout: <html lang dir> follows the [locale] segment, Arabic RTL or English LTR (D-067). */
export default async function LocaleLayout({ children }: Readonly<{ children: ReactNode }>) {
  const locale = await currentLocale();
  const t = await getTranslations('common');
  const meta = await getTranslations('meta');

  return (
    <html
      lang={locale}
      dir={DIRECTION[locale]}
      className={`${cairo.variable} ${tajawal.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* Applies a saved light/dark choice before first paint (D-052). */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="flex min-h-dvh flex-col">
        <NextIntlClientProvider>
          <Providers dir={DIRECTION[locale]}>
            <a href="#main" className="skip-link">
              {t('skipToContent')}
            </a>
            {children}
          </Providers>
        </NextIntlClientProvider>
        <JsonLd data={organizationJsonLd(meta('descriptor'))} />
        <JsonLd data={websiteJsonLd(meta('descriptor'))} />
      </body>
    </html>
  );
}
