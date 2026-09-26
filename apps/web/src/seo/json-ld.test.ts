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
  it('describes the organisation with the Arabic descriptor', () => {
    expect(organizationJsonLd()).toMatchObject({
      '@type': 'Organization',
      name: 'Startup Brand Name',
      alternateName: 'استوديو نموذج العمل',
      url: 'https://startupbrandname.com',
    });
  });

  it('declares the website as Arabic and published by the organisation', () => {
    expect(websiteJsonLd()).toMatchObject({
      '@type': 'WebSite',
      inLanguage: 'ar',
      publisher: { '@id': 'https://startupbrandname.com/#organization' },
    });
  });
});
