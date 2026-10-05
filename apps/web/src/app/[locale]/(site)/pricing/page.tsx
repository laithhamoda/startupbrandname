import type { Metadata } from 'next';
import { BidiText } from '@/components/marketing/bidi-text';
import { PageBody, PageIntro, PageSection } from '@/components/marketing/page-intro';
import { PlanPrice, PricingTable } from '@/components/marketing/pricing-table';
import { RelatedPages } from '@/components/marketing/related-pages';
import { COURSE_PLANS } from '@/config/plans';
import { PRICING } from '@/content/pricing';
import { currentLocale } from '@/i18n/locale';
import { JsonLd } from '@/seo/json-ld';
import { applicationJsonLd, innerPageMetadata, pageBreadcrumbJsonLd } from '@/seo/public-page';

export async function generateMetadata(): Promise<Metadata> {
  return innerPageMetadata(await currentLocale(), 'pricing');
}

export default async function PricingPage() {
  const locale = await currentLocale();
  const text = PRICING[locale];

  return (
    <PageBody>
      <PageIntro title={text.heading} lead={text.lead}>
        <p role="note" className="reading border-s-[3px] border-ink bg-sunken px-4 py-3 text-small">
          {text.notice}
        </p>
      </PageIntro>

      <PricingTable text={text} />

      <div className="grid gap-1 py-6 text-small text-muted">
        <p>{text.fairUse}</p>
        <p>{text.currency}</p>
        <p>{text.payment}</p>
      </div>

      <PageSection id="course" title={text.courseHeading} lead={text.courseLead}>
        <dl className="grid max-w-[48rem] gap-x-12 gap-y-6 sm:grid-cols-2">
          {COURSE_PLANS.map((planId) => (
            <div key={planId} className="grid content-start gap-2 border-t border-hairline pt-4">
              <dt className="font-display font-bold">{text.planNames[planId]}</dt>
              <dd>
                <PlanPrice planId={planId} text={text} />
              </dd>
            </div>
          ))}
        </dl>
        <p className="text-small text-muted">
          <BidiText text={text.voucherNote} />
        </p>
      </PageSection>

      <RelatedPages ids={['howItWorks', 'faq', 'about']} />

      <JsonLd data={applicationJsonLd(locale, 'pricing')} />
      <JsonLd data={await pageBreadcrumbJsonLd(locale, 'pricing')} />
    </PageBody>
  );
}
