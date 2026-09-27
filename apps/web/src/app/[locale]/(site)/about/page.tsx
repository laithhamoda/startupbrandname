import type { Metadata } from 'next';
import { PageBody, PageIntro, PageSection } from '@/components/marketing/page-intro';
import { RelatedPages } from '@/components/marketing/related-pages';
import { ABOUT } from '@/content/about';
import { currentLocale } from '@/i18n/locale';
import { aboutPageJsonLd, JsonLd } from '@/seo/json-ld';
import { innerPageMetadata, pageBreadcrumbJsonLd, pageInfo } from '@/seo/public-page';

export async function generateMetadata(): Promise<Metadata> {
  return innerPageMetadata(await currentLocale(), 'about');
}

export default async function AboutPage() {
  const locale = await currentLocale();
  const c = ABOUT[locale];

  return (
    <PageBody>
      <PageIntro title={c.heading} lead={c.lead} />

      <PageSection id="what" title={c.whatHeading}>
        <p className="reading text-body-lg text-ink-2">{c.what}</p>
      </PageSection>

      <PageSection id="principles" title={c.principlesHeading}>
        <dl className="grid gap-x-12 gap-y-8 md:grid-cols-2 lg:grid-cols-3">
          {c.principles.map((principle) => (
            <div key={principle.title} className="grid content-start gap-1">
              <dt className="font-display text-h3 font-bold">{principle.title}</dt>
              <dd className="text-ink-2">{principle.body}</dd>
            </div>
          ))}
        </dl>
      </PageSection>

      <PageSection id="audience" title={c.audienceHeading}>
        <p className="reading text-ink-2">{c.audience}</p>
      </PageSection>

      <RelatedPages ids={['methodology', 'howItWorks', 'faq']} />

      <JsonLd data={aboutPageJsonLd(pageInfo(locale, 'about'))} />
      <JsonLd data={await pageBreadcrumbJsonLd(locale, 'about')} />
    </PageBody>
  );
}
