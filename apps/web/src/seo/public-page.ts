import 'server-only';
import { getTranslations } from 'next-intl/server';
import { PLANS, type PlanId } from '@/config/plans';
import { publicPage, type PublicPageId } from '@/config/public-pages';
import { PAGE_META } from '@/content/pages';
import { PRICING } from '@/content/pricing';
import type { Locale } from '@/i18n/routing';
import { breadcrumbJsonLd, type PageInfo, webApplicationJsonLd } from './json-ld';
import { publicPageMetadata } from './page-metadata';

/** Everything a public page needs to describe itself: metadata and structured data inputs. */
export function pageInfo(locale: Locale, id: PublicPageId): PageInfo {
  const meta = PAGE_META[locale][id];
  return { locale, path: publicPage(id).path, name: meta.title, description: meta.description };
}

export function innerPageMetadata(locale: Locale, id: PublicPageId) {
  const meta = PAGE_META[locale][id];
  return publicPageMetadata({ locale, id, title: meta.title, description: meta.description });
}

/** Home › page, matching the visible breadcrumbs. */
export async function pageBreadcrumbJsonLd(locale: Locale, id: PublicPageId) {
  const t = await getTranslations({ locale, namespace: 'breadcrumbs' });
  return breadcrumbJsonLd([
    { name: t('home'), locale, path: '' },
    { name: PAGE_META[locale][id].title, locale, path: publicPage(id).path },
  ]);
}

/** The platform with its plans as offers, from the one plan table. */
export function applicationJsonLd(locale: Locale, id: PublicPageId) {
  const text = PRICING[locale];
  const planIds = Object.keys(PLANS) as PlanId[];
  return webApplicationJsonLd(
    pageInfo(locale, id),
    planIds.map((planId) => ({
      name: text.planNames[planId],
      description: text.billing[planId],
      priceUsd: PLANS[planId].priceUsd,
    })),
  );
}
