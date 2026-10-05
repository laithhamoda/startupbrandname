import type { Metadata } from 'next';
import { BidiText } from '@/components/marketing/bidi-text';
import { PageBody, PageIntro, PageSection } from '@/components/marketing/page-intro';
import { RelatedPages } from '@/components/marketing/related-pages';
import { VerdictList } from '@/components/marketing/verdict-list';
import { AXIS_WEIGHTS, METHODOLOGY } from '@/content/methodology';
import { currentLocale } from '@/i18n/locale';
import { articleJsonLd, JsonLd } from '@/seo/json-ld';
import { innerPageMetadata, pageBreadcrumbJsonLd, pageInfo } from '@/seo/public-page';

export async function generateMetadata(): Promise<Metadata> {
  return innerPageMetadata(await currentLocale(), 'methodology');
}

export default async function MethodologyPage() {
  const locale = await currentLocale();
  const c = METHODOLOGY[locale];

  return (
    <PageBody>
      <PageIntro title={c.heading} lead={c.lead} />

      <PageSection id="axes" title={c.axesHeading} lead={c.axesLead}>
        <ol className="grid gap-x-12 md:grid-cols-2">
          {c.axes.map((axis) => (
            <li
              key={axis.letter}
              className="grid content-start gap-1 border-t border-hairline py-4"
            >
              <h3 className="flex items-baseline gap-2 text-h3 font-bold">
                <span lang="en" className="text-muted">
                  {axis.letter}
                </span>
                {axis.name}
              </h3>
              <p className="text-ink-2">
                <BidiText text={axis.covers} />
              </p>
              <p className="text-small text-muted">
                {c.weightLabel}:{' '}
                <bdi className="num font-bold text-ink">{AXIS_WEIGHTS[axis.letter]}%</bdi>
              </p>
            </li>
          ))}
        </ol>
        <p className="reading text-small text-muted">{c.weightNote}</p>
      </PageSection>

      <PageSection id="rules" title={c.rulesHeading} lead={c.rulesLead}>
        <dl className="grid gap-x-10 gap-y-6 md:grid-cols-2">
          {c.rules.map((rule) => (
            <div
              key={rule.trigger}
              className="grid content-start gap-1 border-s-2 border-hairline ps-4"
            >
              <dt className="font-display font-bold">{rule.trigger}</dt>
              <dd className="text-ink-2">
                <BidiText text={rule.response} />
              </dd>
            </div>
          ))}
        </dl>
      </PageSection>

      <PageSection id="provenance" title={c.provenanceHeading} lead={c.provenanceLead}>
        <dl className="grid gap-x-10 gap-y-6 md:grid-cols-3">
          {c.provenance.map((item) => (
            <div key={item.title} className="grid content-start gap-1">
              <dt className="font-display font-bold">{item.title}</dt>
              <dd className="text-ink-2">{item.body}</dd>
            </div>
          ))}
        </dl>
        <p className="reading text-ink-2">{c.confidence}</p>
        <p className="reading text-ink-2">
          <BidiText text={c.verifyNote} />
        </p>
      </PageSection>

      <PageSection id="engine" title={c.engineHeading}>
        {c.engineLead.map((paragraph) => (
          <p key={paragraph} className="reading text-ink-2">
            {paragraph}
          </p>
        ))}
        <dl className="grid max-w-[60rem] border-t border-hairline">
          {c.formulas.map((item) => (
            <div
              key={item.term}
              className="grid gap-1 border-b border-hairline py-3 md:grid-cols-[18rem_1fr] md:gap-6"
            >
              <dt className="font-display font-bold">
                <BidiText text={item.term} />
              </dt>
              <dd className="text-ink-2">{item.formula}</dd>
            </div>
          ))}
        </dl>
        {c.engineNotes.map((paragraph) => (
          <p key={paragraph} className="reading text-ink-2">
            <BidiText text={paragraph} />
          </p>
        ))}
      </PageSection>

      <PageSection id="verdict" title={c.verdictHeading} lead={c.verdictLead}>
        <div className="max-w-[40rem]">
          <VerdictList label={c.verdictHeading} items={c.verdict} />
        </div>
      </PageSection>

      <PageSection id="ai" title={c.aiHeading}>
        <div className="grid gap-x-12 gap-y-8 md:grid-cols-2">
          {[c.aiDoes, c.aiDoesNot].map((group) => (
            <div key={group.title} className="grid content-start gap-3">
              <h3 className="text-h3 font-bold">{group.title}</h3>
              <ul className="grid list-disc gap-2 ps-5 text-ink-2">
                {group.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </PageSection>

      <PageSection id="limits" title={c.limitsHeading}>
        {c.limits.map((paragraph) => (
          <p key={paragraph} className="reading text-ink-2">
            {paragraph}
          </p>
        ))}
      </PageSection>

      <RelatedPages ids={['howItWorks', 'glossary', 'faq']} />

      <JsonLd
        data={articleJsonLd({ ...pageInfo(locale, 'methodology'), dateModified: c.updated })}
      />
      <JsonLd data={await pageBreadcrumbJsonLd(locale, 'methodology')} />
    </PageBody>
  );
}
