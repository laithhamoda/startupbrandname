import type { Metadata } from 'next';
import { BidiText } from '@/components/marketing/bidi-text';
import { PageBody, PageIntro, PageSection } from '@/components/marketing/page-intro';
import { RelatedPages } from '@/components/marketing/related-pages';
import { ButtonLink } from '@/components/ui/button';
import { TextLink } from '@/components/ui/text-link';
import { IDEA_GUIDE, IDEA_GUIDE_UPDATED } from '@/content/idea-guide';
import { currentLocale } from '@/i18n/locale';
import { articleJsonLd, faqJsonLd, howToJsonLd, JsonLd } from '@/seo/json-ld';
import { innerPageMetadata, pageBreadcrumbJsonLd, pageInfo } from '@/seo/public-page';

export async function generateMetadata(): Promise<Metadata> {
  return innerPageMetadata(await currentLocale(), 'ideaGuide');
}

/**
 * The public guide «how to test a business idea» (D-306): answer first, general knowledge, no
 * question wording or rule of the diagnostic, and a plain statement of what the platform does not
 * replace.
 */
export default async function IdeaGuidePage() {
  const locale = await currentLocale();
  const c = IDEA_GUIDE[locale];
  const info = pageInfo(locale, 'ideaGuide');

  return (
    <PageBody>
      <PageIntro title={c.heading} lead={c.lead}>
        <p className="text-small text-muted">
          {c.updatedLabel}: <time dateTime={IDEA_GUIDE_UPDATED}>{IDEA_GUIDE_UPDATED}</time>
        </p>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3 pt-2">
          <ButtonLink href="/signup" variant="primary">
            {c.start}
          </ButtonLink>
          <TextLink href="/sample-report">{c.sample}</TextLink>
        </div>
      </PageIntro>

      <PageSection id="steps" title={c.stepsHeading}>
        <ol className="grid max-w-[44rem] gap-8">
          {c.steps.map((step, index) => (
            <li key={step.id} id={step.id} className="grid scroll-mt-6 gap-1">
              <h3 className="font-display text-h3 font-bold">
                <span className="num text-muted">{index + 1}.</span> {step.title}
              </h3>
              <p className="reading text-ink-2">
                <BidiText text={step.body} />
              </p>
            </li>
          ))}
        </ol>
      </PageSection>

      <PageSection id="formulas" title={c.formulasHeading} lead={c.formulasLead}>
        <dl className="grid max-w-[44rem] gap-5">
          {c.formulas.map((formula) => (
            <div key={formula.id} className="grid gap-1">
              <dt className="font-display font-bold">
                <BidiText text={formula.name} />
              </dt>
              <dd className="reading text-ink-2">
                <BidiText text={formula.formula} />
              </dd>
            </div>
          ))}
        </dl>
        <h3 className="pt-6 font-display text-h3 font-bold">{c.exampleHeading}</h3>
        <ul className="grid max-w-[44rem] gap-2 ps-5">
          {c.example.map((line) => (
            <li key={line} className="reading list-disc text-ink-2">
              <BidiText text={line} />
            </li>
          ))}
        </ul>
        <p className="reading max-w-[44rem] text-small text-muted">{c.exampleNote}</p>
      </PageSection>

      <PageSection id="mistakes" title={c.mistakesHeading}>
        <dl className="grid max-w-[44rem] gap-5">
          {c.mistakes.map((mistake) => (
            <div key={mistake.title} className="grid gap-1">
              <dt className="font-display font-bold">{mistake.title}</dt>
              <dd className="reading text-ink-2">{mistake.body}</dd>
            </div>
          ))}
        </dl>
      </PageSection>

      <PageSection id="platform" title={c.toolHeading}>
        <div className="grid max-w-[44rem] gap-6">
          <div className="grid gap-2">
            <h3 className="font-display text-h3 font-bold">{c.helpsLabel}</h3>
            <ul className="grid gap-2 ps-5">
              {c.helps.map((line) => (
                <li key={line} className="reading list-disc text-ink-2">
                  {line}
                </li>
              ))}
            </ul>
          </div>
          <div className="grid gap-2">
            <h3 className="font-display text-h3 font-bold">{c.limitsLabel}</h3>
            <ul className="grid gap-2 ps-5">
              {c.limits.map((line) => (
                <li key={line} className="reading list-disc text-ink-2">
                  <BidiText text={line} />
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
            <TextLink href="/questions">{c.questions}</TextLink>
            <TextLink href="/methodology">{c.method}</TextLink>
          </div>
        </div>
      </PageSection>

      <PageSection id="faq" title={c.faqHeading}>
        <dl className="grid max-w-[44rem] gap-6">
          {c.faq.map((item) => (
            <div key={item.id} id={item.id} className="grid scroll-mt-6 gap-1">
              <dt className="font-display font-bold">{item.question}</dt>
              <dd className="reading text-ink-2">
                <BidiText text={item.answer} />
              </dd>
            </div>
          ))}
        </dl>
      </PageSection>

      <RelatedPages ids={['methodology', 'questions', 'sampleReport']} />

      <JsonLd data={articleJsonLd({ ...info, dateModified: IDEA_GUIDE_UPDATED })} />
      <JsonLd
        data={howToJsonLd(
          info,
          c.steps.map((step) => ({ id: step.id, title: step.title, text: step.body })),
        )}
      />
      <JsonLd data={faqJsonLd(info, c.faq)} />
      <JsonLd data={await pageBreadcrumbJsonLd(locale, 'ideaGuide')} />
    </PageBody>
  );
}
