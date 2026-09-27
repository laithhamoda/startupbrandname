import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { ogImageName, PUBLIC_PAGES } from '@/config/public-pages';
import { site } from '@/config/site';
import { PAGE_META } from '@/content/pages';
import { getServerEnv } from '@/env/server';
import { currentLocale } from '@/i18n/locale';
import { routing } from '@/i18n/routing';

/** The card's file name without ".png": "home", "how-it-works"… */
function cardSlug(id: (typeof PUBLIC_PAGES)[number]['id']): string {
  return ogImageName(id).replace(/\.png$/, '');
}

export const dynamicParams = false;

export function generateStaticParams() {
  return routing.locales.flatMap((locale) =>
    PUBLIC_PAGES.map((page) => ({ locale, page: cardSlug(page.id) })),
  );
}

export const metadata: Metadata = { robots: { index: false, follow: false } };

/**
 * Source of the share images in public/og, screenshotted by e2e/og-images.gen.ts. A real browser
 * renders it because Next's image generator cannot shape Arabic (M1 design plan). Local and CI
 * builds only: every Vercel deployment answers 404.
 */
export default async function OgCardPage({ params }: PageProps<'/[locale]/og-card/[page]'>) {
  if (getServerEnv().VERCEL_ENV) notFound();
  const locale = await currentLocale();
  const { page: slug } = await params;
  const page = PUBLIC_PAGES.find((candidate) => cardSlug(candidate.id) === slug);
  if (!page) notFound();
  const meta = await getTranslations('meta');

  return (
    <div
      data-og-card
      className="flex h-[630px] w-[1200px] flex-col justify-between bg-slab px-20 py-16 text-slab-text"
    >
      <p className="flex items-baseline gap-5">
        <span lang="en" dir="ltr" className="font-display text-[40px] font-extrabold">
          {site.name}
        </span>
        <span className="text-[30px] text-slab-muted">{meta('descriptor')}</span>
      </p>
      <div className="grid gap-8">
        <span aria-hidden className="block h-1.5 w-40 bg-gold" />
        <p className="max-w-[980px] font-display text-[68px] leading-[1.3] font-extrabold">
          {PAGE_META[locale][page.id].card}
        </p>
      </div>
      <p className="text-[28px] text-slab-muted">
        <span lang="en" dir="ltr">
          startupbrandname.com
        </span>
      </p>
    </div>
  );
}
