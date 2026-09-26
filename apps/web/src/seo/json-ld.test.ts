import { describe, expect, it } from 'vitest';
import { organizationJsonLd, serializeJsonLd, websiteJsonLd } from './json-ld';

describe('serializeJsonLd', () => {
  it('escapes "<" so a value cannot close the script tag', () => {
    const output = serializeJsonLd({ name: '</script><script>alert(1)</script>' });

    expect(output).not.toContain('<');
    expect(JSON.parse(output)).toEqual({ name: '</script><script>alert(1)</script>' });
  });
});

describe('structured data', () => {
  it('describes the organisation with the descriptor in the page language', () => {
    expect(organizationJsonLd('استوديو نموذج العمل')).toMatchObject({
      '@type': 'Organization',
      name: 'Startup Brand Name',
      alternateName: 'استوديو نموذج العمل',
      url: 'https://startupbrandname.com',
    });
  });

  it('declares the website as Arabic and English, published by the organisation', () => {
    expect(websiteJsonLd('Business Model Studio')).toMatchObject({
      '@type': 'WebSite',
      alternateName: 'Business Model Studio',
      inLanguage: ['ar', 'en'],
      publisher: { '@id': 'https://startupbrandname.com/#organization' },
    });
  });
});
