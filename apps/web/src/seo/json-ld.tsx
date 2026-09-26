import { site } from '@/config/site';

type JsonLdObject = Record<string, unknown>;

/** Serialises JSON-LD for an inline script. Escapes "<" so no value can close the script tag. */
export function serializeJsonLd(data: JsonLdObject): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

export function JsonLd({ data }: { data: JsonLdObject }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
    />
  );
}

/** Only facts that are true today; logo, founder and social profiles are added when they exist. */
export function organizationJsonLd(): JsonLdObject {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${site.origin}/#organization`,
    name: site.name,
    alternateName: site.descriptor,
    url: site.origin,
  };
}

export function websiteJsonLd(): JsonLdObject {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${site.origin}/#website`,
    name: site.name,
    alternateName: site.descriptor,
    url: site.origin,
    inLanguage: 'ar',
    publisher: { '@id': `${site.origin}/#organization` },
  };
}
