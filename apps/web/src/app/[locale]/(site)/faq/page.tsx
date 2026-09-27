import type { Metadata } from 'next';
import { BidiText } from '@/components/marketing/bidi-text';
import { PageBody, PageIntro } from '@/components/marketing/page-intro';
import { RelatedPages } from '@/components/marketing/related-pages';
import { FAQ } from '@/content/faq';
import { currentLocale } from '@/i18n/locale';
import { faqJsonLd, JsonLd } from '@/seo/json-ld';
import { innerPageMetadata, pageBreadcrumbJsonLd, pageInfo } from '@/seo/public-page';

export async function generateMetadata(): Promise<Metadata> {
  return innerPageMetadata(await currentLocale(), 'faq');
}

export default async function FaqPage() {
  const locale = await currentLocale();
  const c = FAQ[locale];

  return (
    <PageBody>
      <PageIntro title={c.heading} lead={c.lead} />

      {/* Questions and answers stay open: nothing to click before reading, and the text the
          structured data describes is the text on screen. */}
      <div className="grid border-t border-hairline">
        {c.items.map((item) => (
          <section
            key={item.id}
            id={item.id}
            aria-labelledby={`${item.id}-question`}
            className="grid scroll-mt-6 gap-2 border-b border-hairline py-6"
          >
            <h2 id={`${item.id}-question`} className="text-h3 font-bold">
              {item.question}
            </h2>
            <p className="reading text-ink-2">
              <BidiText text={item.answer} />
            </p>
          </section>
        ))}
      </div>

      <RelatedPages ids={['howItWorks', 'pricing', 'methodology']} />

      <JsonLd data={faqJsonLd(pageInfo(locale, 'faq'), c.items)} />
      <JsonLd data={await pageBreadcrumbJsonLd(locale, 'faq')} />
    </PageBody>
  );
}
