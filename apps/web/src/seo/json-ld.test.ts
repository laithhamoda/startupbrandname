import { describe, expect, it } from 'vitest';
import {
  articleJsonLd,
  breadcrumbJsonLd,
  definedTermSetJsonLd,
  faqJsonLd,
  howToJsonLd,
  organizationJsonLd,
  serializeJsonLd,
  webApplicationJsonLd,
  websiteJsonLd,
} from './json-ld';

const PAGE = {
  locale: 'ar',
  path: '/glossary',
  name: 'مسرد',
  description: 'تعريفات',
} as const;

describe('serializeJsonLd', () => {
  it('escapes "<" so a value cannot close the script tag', () => {
    const data = {
      '@context': 'https://schema.org',
      '@type': 'Thing',
      name: '</script><script>alert(1)</script>',
    } as const;
    const output = serializeJsonLd(data);

    expect(output).not.toContain('<');
    expect(JSON.parse(output)).toEqual(data);
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

  it('numbers breadcrumbs from 1 with absolute URLs', () => {
    expect(
      breadcrumbJsonLd([
        { name: 'الرئيسية', locale: 'ar', path: '' },
        { name: 'مسرد', locale: 'ar', path: '/glossary' },
      ]).itemListElement,
    ).toEqual([
      {
        '@type': 'ListItem',
        position: 1,
        name: 'الرئيسية',
        item: 'https://startupbrandname.com/ar',
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'مسرد',
        item: 'https://startupbrandname.com/ar/glossary',
      },
    ]);
  });

  it('turns each question into a Question with its accepted answer', () => {
    expect(faqJsonLd(PAGE, [{ question: 'س؟', answer: 'ج.' }])).toMatchObject({
      '@type': 'FAQPage',
      inLanguage: 'ar',
      mainEntity: [
        { '@type': 'Question', name: 'س؟', acceptedAnswer: { '@type': 'Answer', text: 'ج.' } },
      ],
    });
  });

  it('links every defined term to its anchor and its set', () => {
    const set = definedTermSetJsonLd(PAGE, [
      {
        id: 'break-even',
        name: 'نقطة التعادل',
        alternateName: 'Break-even point',
        description: 'd',
      },
    ]);
    expect(set).toMatchObject({
      '@type': 'DefinedTermSet',
      '@id': 'https://startupbrandname.com/ar/glossary#terms',
      hasDefinedTerm: [
        {
          '@type': 'DefinedTerm',
          url: 'https://startupbrandname.com/ar/glossary#break-even',
          alternateName: 'Break-even point',
          inDefinedTermSet: { '@id': 'https://startupbrandname.com/ar/glossary#terms' },
        },
      ],
    });
  });

  it('numbers how-to steps and links them to their anchors', () => {
    expect(howToJsonLd(PAGE, [{ id: 'account', title: 't', text: 'x' }]).step).toEqual([
      {
        '@type': 'HowToStep',
        position: 1,
        name: 't',
        text: 'x',
        url: 'https://startupbrandname.com/ar/glossary#account',
      },
    ]);
  });

  it('prices every offer in US dollars', () => {
    const app = webApplicationJsonLd(PAGE, [
      { name: 'Free', description: 'd', priceUsd: 0 },
      { name: 'Monthly', description: 'd', priceUsd: 17 },
    ]);
    expect(app).toMatchObject({
      '@type': 'WebApplication',
      offers: [
        { '@type': 'Offer', price: 0, priceCurrency: 'USD' },
        { '@type': 'Offer', price: 17, priceCurrency: 'USD' },
      ],
    });
  });

  it('dates the article and credits the organisation', () => {
    expect(articleJsonLd({ ...PAGE, dateModified: '2026-09-27' })).toMatchObject({
      '@type': 'Article',
      dateModified: '2026-09-27',
      author: { '@id': 'https://startupbrandname.com/#organization' },
    });
  });
});
