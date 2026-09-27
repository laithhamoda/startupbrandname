import type { Metadata } from 'next';
import { PageBody, PageIntro, PageSection } from '@/components/marketing/page-intro';
import { RelatedPages } from '@/components/marketing/related-pages';
import {
  GLOSSARY,
  GLOSSARY_CATEGORIES,
  GLOSSARY_INTRO,
  type GlossaryCategory,
} from '@/content/glossary';
import { currentLocale } from '@/i18n/locale';
import type { Locale } from '@/i18n/routing';
import { definedTermSetJsonLd, JsonLd } from '@/seo/json-ld';
import { innerPageMetadata, pageBreadcrumbJsonLd, pageInfo } from '@/seo/public-page';

export async function generateMetadata(): Promise<Metadata> {
  return innerPageMetadata(await currentLocale(), 'glossary');
}

const CATEGORY_ORDER: readonly GlossaryCategory[] = [
  'model',
  'costs',
  'cash',
  'customers',
  'market',
];

export default async function GlossaryPage() {
  const locale = await currentLocale();
  const intro = GLOSSARY_INTRO[locale];
  const other: Locale = locale === 'ar' ? 'en' : 'ar';

  return (
    <PageBody>
      <PageIntro title={intro.heading} lead={intro.lead}>
        <nav aria-label={intro.sections}>
          <ul className="flex flex-wrap gap-x-5 gap-y-2 text-small">
            {CATEGORY_ORDER.map((category) => (
              <li key={category}>
                <a
                  href={`#${category}`}
                  className="text-teal-ink underline underline-offset-4 hover:no-underline"
                >
                  {GLOSSARY_CATEGORIES[locale][category]}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </PageIntro>

      {CATEGORY_ORDER.map((category) => (
        <PageSection key={category} id={category} title={GLOSSARY_CATEGORIES[locale][category]}>
          <dl className="grid gap-x-12 gap-y-8 md:grid-cols-2">
            {GLOSSARY.filter((term) => term.category === category).map((term) => (
              <div key={term.id} id={term.id} className="grid scroll-mt-6 content-start gap-1">
                <dt className="grid gap-0.5">
                  <dfn className="font-display text-h3 font-bold not-italic">
                    {term.text[locale].term}
                  </dfn>
                  <span className="text-small text-muted">
                    {intro.english}:{' '}
                    <span lang={other} dir="auto">
                      {term.text[other].term}
                    </span>
                  </span>
                </dt>
                <dd className="reading text-ink-2">{term.text[locale].definition}</dd>
              </div>
            ))}
          </dl>
        </PageSection>
      ))}

      <RelatedPages ids={['methodology', 'howItWorks', 'faq']} />

      <JsonLd
        data={definedTermSetJsonLd(
          pageInfo(locale, 'glossary'),
          GLOSSARY.map((term) => ({
            id: term.id,
            name: term.text[locale].term,
            alternateName: term.text[other].term,
            description: term.text[locale].definition,
          })),
        )}
      />
      <JsonLd data={await pageBreadcrumbJsonLd(locale, 'glossary')} />
    </PageBody>
  );
}
