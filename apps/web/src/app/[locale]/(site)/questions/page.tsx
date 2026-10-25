import { QUESTIONS, questionsFor } from '@sbn/question-bank';
import type { Metadata } from 'next';
import { PageBody, PageIntro, PageSection } from '@/components/marketing/page-intro';
import { RelatedPages } from '@/components/marketing/related-pages';
import { ButtonLink } from '@/components/ui/button';
import { TextLink } from '@/components/ui/text-link';
import {
  privateQuestionCount,
  QUESTIONS_PAGE,
  quickQuestionsByAxis,
} from '@/content/quick-questions';
import { currentLocale } from '@/i18n/locale';
import { JsonLd, webPageJsonLd } from '@/seo/json-ld';
import { innerPageMetadata, pageBreadcrumbJsonLd, pageInfo } from '@/seo/public-page';

export async function generateMetadata(): Promise<Metadata> {
  return innerPageMetadata(await currentLocale(), 'questions');
}

/**
 * The 20 quick-mode questions, worded as the diagnostic asks them, and a plain note that the rest
 * stay inside it (D-304). Nothing else about the question bank is rendered here.
 */
export default async function QuestionsPage() {
  const locale = await currentLocale();
  const text = QUESTIONS_PAGE[locale];
  const groups = quickQuestionsByAxis(locale);
  const counts = {
    quick: questionsFor('quick').length,
    total: QUESTIONS.length,
    hidden: privateQuestionCount(),
    axes: groups.length,
  };
  // The list is numbered across the axes, in the order the diagnostic asks it.
  const starts = groups.map((_, index) =>
    groups.slice(0, index).reduce((sum, earlier) => sum + earlier.questions.length, 1),
  );

  return (
    <PageBody>
      <PageIntro title={text.heading} lead={text.lead(counts)}>
        <p role="note" className="reading border-s-[3px] border-ink bg-sunken px-4 py-3 text-small">
          {text.notice(counts)}
        </p>
        <p className="reading text-small text-muted">{text.how}</p>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3 pt-2">
          <ButtonLink href="/signup" variant="primary">
            {text.start}
          </ButtonLink>
          <TextLink href="/methodology">{text.method}</TextLink>
        </div>
      </PageIntro>

      {groups.map((group, index) => {
        return (
          <PageSection key={group.axis} id={`axis-${String(index + 1)}`} title={group.name}>
            <ol start={starts[index]} className="grid max-w-[44rem] gap-3 ps-6">
              {group.questions.map((question) => (
                <li key={question} className="reading list-decimal ps-1 text-ink-2">
                  {question}
                </li>
              ))}
            </ol>
          </PageSection>
        );
      })}

      <RelatedPages ids={['methodology', 'sampleReport', 'glossary']} />

      <JsonLd data={webPageJsonLd(pageInfo(locale, 'questions'))} />
      <JsonLd data={await pageBreadcrumbJsonLd(locale, 'questions')} />
    </PageBody>
  );
}
