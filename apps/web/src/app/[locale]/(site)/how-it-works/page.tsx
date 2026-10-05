import type { Metadata } from 'next';
import { BidiText } from '@/components/marketing/bidi-text';
import { PageBody, PageIntro, PageSection } from '@/components/marketing/page-intro';
import { RelatedPages } from '@/components/marketing/related-pages';
import { HOW_IT_WORKS } from '@/content/how-it-works';
import { currentLocale } from '@/i18n/locale';
import { howToJsonLd, JsonLd } from '@/seo/json-ld';
import { innerPageMetadata, pageBreadcrumbJsonLd, pageInfo } from '@/seo/public-page';

export async function generateMetadata(): Promise<Metadata> {
  return innerPageMetadata(await currentLocale(), 'howItWorks');
}

export default async function HowItWorksPage() {
  const locale = await currentLocale();
  const c = HOW_IT_WORKS[locale];

  return (
    <PageBody>
      <PageIntro title={c.heading} lead={c.lead} />

      <PageSection id="steps" title={c.stepsHeading}>
        <ol className="grid gap-10">
          {c.steps.map((step, index) => (
            <li
              key={step.id}
              id={step.id}
              className="grid scroll-mt-6 gap-3 md:grid-cols-[4rem_1fr] md:gap-6"
            >
              <span aria-hidden className="font-display text-h2 font-extrabold text-muted">
                <bdi className="num">{index + 1}</bdi>
              </span>
              <div className="grid gap-2">
                <h3 className="text-h3 font-bold">{step.title}</h3>
                {step.body.map((paragraph) => (
                  <p key={paragraph} className="reading text-ink-2">
                    <BidiText text={paragraph} />
                  </p>
                ))}
              </div>
            </li>
          ))}
        </ol>
      </PageSection>

      <PageSection id="completeness" title={c.gatingHeading} lead={c.gatingLead}>
        <table className="w-full max-w-[60rem] border-collapse text-start">
          <caption className="sr-only">{c.gatingCaption}</caption>
          <thead>
            <tr>
              <th
                scope="col"
                className="border-b border-control py-2 pe-6 text-start text-small font-bold text-muted"
              >
                {c.gatingColumns.threshold}
              </th>
              <th
                scope="col"
                className="border-b border-control py-2 text-start text-small font-bold text-muted"
              >
                {c.gatingColumns.result}
              </th>
            </tr>
          </thead>
          <tbody>
            {c.gating.map((row) => (
              <tr key={row.threshold}>
                <th
                  scope="row"
                  className="border-b border-hairline py-3 pe-6 text-start align-top font-display font-bold"
                >
                  <BidiText text={row.threshold} />
                </th>
                <td className="border-b border-hairline py-3 align-top text-ink-2">{row.result}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </PageSection>

      <RelatedPages ids={['methodology', 'pricing', 'faq']} />

      <JsonLd
        data={howToJsonLd(
          pageInfo(locale, 'howItWorks'),
          c.steps.map((step) => ({ id: step.id, title: step.title, text: step.body.join(' ') })),
        )}
      />
      <JsonLd data={await pageBreadcrumbJsonLd(locale, 'howItWorks')} />
    </PageBody>
  );
}
