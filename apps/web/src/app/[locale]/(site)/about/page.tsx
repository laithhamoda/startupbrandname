import type { Metadata } from 'next';
import Image from 'next/image';
import { PageBody, PageIntro, PageSection } from '@/components/marketing/page-intro';
import { RelatedPages } from '@/components/marketing/related-pages';
import { FOUNDER } from '@/config/founder';
import { ABOUT } from '@/content/about';
import { currentLocale } from '@/i18n/locale';
import { aboutPageJsonLd, founderJsonLd, JsonLd, organizationFounderJsonLd } from '@/seo/json-ld';
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

      <PageSection id="founder" title={c.founderHeading}>
        <div className="grid items-start gap-6 sm:grid-cols-[16rem_1fr] sm:gap-10">
          {/* A fixed, pre-sized WebP: the optimiser has nothing to add, and the box is reserved
              by the 4:5 ratio, so the page does not shift while the picture loads. */}
          <Image
            src={FOUNDER.photo.path}
            alt={c.founderPhotoAlt}
            width={FOUNDER.photo.width}
            height={FOUNDER.photo.height}
            sizes="(min-width: 640px) 16rem, 70vw"
            unoptimized
            className="aspect-[4/5] w-full max-w-[16rem] border border-hairline object-cover"
          />
          <div className="grid content-start gap-2">
            <h3 className="font-display text-h3 font-bold">{FOUNDER.name[locale]}</h3>
            <p className="text-small text-muted">
              {FOUNDER.jobTitle[locale]} · {c.founderPlace}
            </p>
            <p className="reading text-ink-2">{c.founderBio}</p>
            <p>
              <a
                href={FOUNDER.linkedin}
                rel="me noopener noreferrer"
                className="text-teal-ink underline underline-offset-4 hover:no-underline"
              >
                {c.founderLinkedin}{' '}
                <bdi lang="en" dir="ltr">
                  LinkedIn
                </bdi>
              </a>
            </p>
          </div>
        </div>
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
      <JsonLd data={founderJsonLd(locale)} />
      <JsonLd data={organizationFounderJsonLd()} />
      <JsonLd data={await pageBreadcrumbJsonLd(locale, 'about')} />
    </PageBody>
  );
}
