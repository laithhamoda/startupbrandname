import type {
  AboutPage,
  Article,
  BreadcrumbList,
  DefinedTermSet,
  FAQPage,
  HowTo,
  Offer,
  Organization,
  Thing,
  WebApplication,
  WebPage,
  WebSite,
  WithContext,
} from 'schema-dts';
import { site } from '@/config/site';
import { routing, type Locale } from '@/i18n/routing';

/** Serialises JSON-LD for an inline script. Escapes "<" so no value can close the script tag. */
export function serializeJsonLd(data: WithContext<Thing>): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

export function JsonLd({ data }: { data: WithContext<Thing> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
    />
  );
}

const ORGANIZATION_ID = `${site.origin}/#organization`;
const WEBSITE_ID = `${site.origin}/#website`;

/** Absolute URL of a page in a language: '' is the home page. */
export function pageUrl(locale: Locale, path: string): string {
  return `${site.origin}/${locale}${path}`;
}

/**
 * Only facts that are true today; logo, founder and social profiles are added when they exist.
 * `descriptor` is the translated "Business Model Studio" for the page's language.
 */
export function organizationJsonLd(descriptor: string): WithContext<Organization> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': ORGANIZATION_ID,
    name: site.name,
    alternateName: descriptor,
    url: site.origin,
  };
}

export function websiteJsonLd(descriptor: string): WithContext<WebSite> {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': WEBSITE_ID,
    name: site.name,
    alternateName: descriptor,
    url: site.origin,
    inLanguage: [...routing.locales],
    publisher: { '@id': ORGANIZATION_ID },
  };
}

export interface PageInfo {
  locale: Locale;
  path: string;
  name: string;
  description: string;
}

/** Fields every page shares: its URL, language and place in the site. */
function pageFields({ locale, path, name, description }: PageInfo) {
  const url = pageUrl(locale, path);
  return {
    '@id': `${url}#webpage`,
    url,
    name,
    description,
    inLanguage: locale,
    isPartOf: { '@id': WEBSITE_ID },
  } as const;
}

export function webPageJsonLd(page: PageInfo): WithContext<WebPage> {
  return { '@context': 'https://schema.org', '@type': 'WebPage', ...pageFields(page) };
}

export function aboutPageJsonLd(page: PageInfo): WithContext<AboutPage> {
  return {
    '@context': 'https://schema.org',
    '@type': 'AboutPage',
    ...pageFields(page),
    about: { '@id': ORGANIZATION_ID },
  };
}

export function breadcrumbJsonLd(
  items: readonly { name: string; locale: Locale; path: string }[],
): WithContext<BreadcrumbList> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: pageUrl(item.locale, item.path),
    })),
  };
}

export function howToJsonLd(
  page: PageInfo,
  steps: readonly { id: string; title: string; text: string }[],
): WithContext<HowTo> {
  const url = pageUrl(page.locale, page.path);
  return {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: page.name,
    description: page.description,
    inLanguage: page.locale,
    url,
    step: steps.map((step, index) => ({
      '@type': 'HowToStep',
      position: index + 1,
      name: step.title,
      text: step.text,
      url: `${url}#${step.id}`,
    })),
  };
}

export function articleJsonLd(page: PageInfo & { dateModified: string }): WithContext<Article> {
  const url = pageUrl(page.locale, page.path);
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: page.name,
    description: page.description,
    inLanguage: page.locale,
    url,
    mainEntityOfPage: url,
    dateModified: page.dateModified,
    author: { '@id': ORGANIZATION_ID },
    publisher: { '@id': ORGANIZATION_ID },
  };
}

export function faqJsonLd(
  page: PageInfo,
  items: readonly { question: string; answer: string }[],
): WithContext<FAQPage> {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    ...pageFields(page),
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  };
}

export function definedTermSetJsonLd(
  page: PageInfo,
  terms: readonly { id: string; name: string; alternateName: string; description: string }[],
): WithContext<DefinedTermSet> {
  const url = pageUrl(page.locale, page.path);
  return {
    '@context': 'https://schema.org',
    '@type': 'DefinedTermSet',
    '@id': `${url}#terms`,
    name: page.name,
    description: page.description,
    inLanguage: page.locale,
    url,
    hasDefinedTerm: terms.map((term) => ({
      '@type': 'DefinedTerm',
      '@id': `${url}#${term.id}`,
      name: term.name,
      alternateName: term.alternateName,
      description: term.description,
      url: `${url}#${term.id}`,
      inDefinedTermSet: { '@id': `${url}#terms` },
    })),
  };
}

/** The platform as an application, with its plans as offers (prices in USD, CLAUDE.md §3). */
export function webApplicationJsonLd(
  page: PageInfo,
  offers: readonly { name: string; description: string; priceUsd: number }[],
): WithContext<WebApplication> {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: site.name,
    description: page.description,
    url: site.origin,
    inLanguage: [...routing.locales],
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    publisher: { '@id': ORGANIZATION_ID },
    offers: offers.map((offer): Offer => ({
      '@type': 'Offer',
      name: offer.name,
      description: offer.description,
      price: offer.priceUsd,
      priceCurrency: 'USD',
      url: pageUrl(page.locale, page.path),
    })),
  };
}
