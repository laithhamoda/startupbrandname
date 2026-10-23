import type { ReportModel } from '@sbn/report/model';
import type { Metadata } from 'next';
import { getMessages } from 'next-intl/server';
import { PageBody, PageIntro } from '@/components/marketing/page-intro';
import { RelatedPages } from '@/components/marketing/related-pages';
import { ReportView } from '@/components/report/report-view';
import { ButtonLink } from '@/components/ui/button';
import { TextLink } from '@/components/ui/text-link';
import { SAMPLE_PAGE } from '@/content/sample-page';
import ar from '@/content/sample-report/ar.json';
import en from '@/content/sample-report/en.json';
import { currentLocale } from '@/i18n/locale';
import { JsonLd, webPageJsonLd } from '@/seo/json-ld';
import { innerPageMetadata, pageBreadcrumbJsonLd, pageInfo } from '@/seo/public-page';

/** The frozen models of the fictional project; sample-report.test.ts keeps them current (D-293). */
const SAMPLES = { ar, en } as unknown as Record<'ar' | 'en', ReportModel>;

export async function generateMetadata(): Promise<Metadata> {
  return innerPageMetadata(await currentLocale(), 'sampleReport');
}

/**
 * A full report for a fictional project, drawn by the same view as the real report but with no
 * database and no account: the page that shows what the product gives before anyone signs up.
 */
export default async function SampleReportPage() {
  const locale = await currentLocale();
  const text = SAMPLE_PAGE[locale];
  const labels = (await getMessages()).report;

  return (
    <>
      <PageBody>
        <PageIntro title={text.heading} lead={text.lead}>
          <p
            role="note"
            className="reading border-s-[3px] border-ink bg-sunken px-4 py-3 text-small"
          >
            {text.notice}
          </p>
          <p className="reading text-small text-muted">{text.omitted}</p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3 pt-2">
            <ButtonLink href="/signup" variant="primary">
              {text.start}
            </ButtonLink>
            <TextLink href="/pricing">{text.plans}</TextLink>
          </div>
        </PageIntro>
      </PageBody>

      <ReportView
        model={SAMPLES[locale]}
        labels={labels}
        hrefs={{ project: '/signup', pricing: '/pricing' }}
        embedded
      />

      <PageBody>
        <RelatedPages ids={['howItWorks', 'methodology', 'pricing']} />
        <JsonLd data={webPageJsonLd(pageInfo(locale, 'sampleReport'))} />
        <JsonLd data={await pageBreadcrumbJsonLd(locale, 'sampleReport')} />
      </PageBody>
    </>
  );
}
