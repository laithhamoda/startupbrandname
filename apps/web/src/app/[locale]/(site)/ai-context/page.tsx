import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PageBody, PageIntro, PageSection } from '@/components/marketing/page-intro';
import {
  AI_CONTEXT_DESCRIPTION,
  AI_CONTEXT_LEAD,
  AI_CONTEXT_SECTIONS,
  AI_CONTEXT_TITLE,
  STATUS_LABEL,
} from '@/content/ai-context';
import { AI_CONTEXT_PATH } from '@/i18n/arabic-only';
import { currentLocale } from '@/i18n/locale';
import { aiContextJsonLd, JsonLd } from '@/seo/json-ld';

export function generateMetadata(): Metadata {
  return {
    title: AI_CONTEXT_TITLE,
    description: AI_CONTEXT_DESCRIPTION,
    alternates: { canonical: AI_CONTEXT_PATH },
    openGraph: {
      type: 'website',
      url: AI_CONTEXT_PATH,
      title: AI_CONTEXT_TITLE,
      description: AI_CONTEXT_DESCRIPTION,
      locale: 'en_US',
    },
  };
}

/**
 * A plain-English page for AI assistants and analysts (D-337). The proxy serves it at
 * /ai-context from the English locale, so the whole text is in the server-rendered HTML.
 */
export default async function AiContextPage() {
  if ((await currentLocale()) !== 'en') notFound();

  return (
    <PageBody>
      <PageIntro title={AI_CONTEXT_TITLE} lead={AI_CONTEXT_LEAD} />

      {AI_CONTEXT_SECTIONS.map((section) => (
        <PageSection key={section.id} id={section.id} title={section.title}>
          {section.paragraphs?.map((text) => (
            <p key={text} className="reading text-ink-2">
              {text}
            </p>
          ))}
          {section.bullets ? (
            <ul className="reading grid list-disc gap-2 ps-6 text-ink-2">
              {section.bullets.map((text) => (
                <li key={text}>{text}</li>
              ))}
            </ul>
          ) : null}
          {section.features ? (
            <dl className="grid gap-x-12 gap-y-8 md:grid-cols-2">
              {section.features.map((feature) => (
                <div key={feature.name} className="grid content-start gap-1">
                  <dt className="font-display text-h3 font-bold">{feature.name}</dt>
                  <dd className="grid gap-1 text-ink-2">
                    {/* The status is written out, never shown by colour alone. */}
                    <span className="text-small font-bold text-ink">
                      {`Status: ${STATUS_LABEL[feature.status]}`}
                    </span>
                    <span>{feature.body}</span>
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}
        </PageSection>
      ))}

      <JsonLd data={aiContextJsonLd(AI_CONTEXT_TITLE, AI_CONTEXT_DESCRIPTION)} />
    </PageBody>
  );
}
