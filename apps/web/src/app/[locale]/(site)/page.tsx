import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { BidiText } from '@/components/marketing/bidi-text';
import { PageSection } from '@/components/marketing/page-intro';
import { VerdictList } from '@/components/marketing/verdict-list';
import { ButtonLink } from '@/components/ui/button';
import { Money } from '@/components/ui/money';
import { TextLink } from '@/components/ui/text-link';
import { lowestPaidPrice } from '@/config/plans';
import { HOME } from '@/content/home';
import { PAGE_META } from '@/content/pages';
import { currentLocale } from '@/i18n/locale';
import { JsonLd, webPageJsonLd } from '@/seo/json-ld';
import { publicPageMetadata } from '@/seo/page-metadata';
import { applicationJsonLd, pageInfo } from '@/seo/public-page';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await currentLocale();
  return publicPageMetadata({
    locale,
    id: 'home',
    title: null,
    description: PAGE_META[locale].home.description,
  });
}

export default async function HomePage() {
  const locale = await currentLocale();
  const c = HOME[locale];
  const nav = await getTranslations('nav');

  return (
    <>
      <div className="mx-auto grid max-w-[75rem] gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-start lg:gap-16 lg:py-24">
        <div className="grid content-start gap-6">
          <h1 className="text-display font-extrabold">{c.heading}</h1>
          <p className="reading text-body-lg text-ink-2">{c.lead}</p>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <ButtonLink href="/signup" variant="primary">
              {c.start}
            </ButtonLink>
            <TextLink href="/how-it-works">{c.secondary}</TextLink>
          </div>
          <p className="reading border-s-2 border-hairline ps-3 text-small text-muted">
            {c.status}
          </p>
        </div>
        <VerdictList label={c.verdictLabel} items={c.verdict} />
      </div>

      <div className="mx-auto max-w-[75rem] px-4 sm:px-6">
        <PageSection id="steps" title={c.stepsHeading}>
          {/* Numbered because the stages are a real sequence (M1 design plan). */}
          <ol className="grid gap-8 md:grid-cols-3">
            {c.steps.map((step, index) => (
              <li key={step.title} className="grid content-start gap-2 border-t-2 border-ink pt-4">
                <span aria-hidden className="font-display text-h3 font-extrabold text-muted">
                  <bdi className="num">{index + 1}</bdi>
                </span>
                <h3 className="text-h3 font-bold">{step.title}</h3>
                <p className="text-ink-2">
                  <BidiText text={step.body} />
                </p>
              </li>
            ))}
          </ol>
        </PageSection>

        <PageSection id="why" title={c.whyHeading} lead={c.whyLead}>
          <ul className="grid gap-x-12 gap-y-8 md:grid-cols-2">
            {c.why.map((item) => (
              <li key={item.title} className="grid content-start gap-1">
                <h3 className="text-h3 font-bold">{item.title}</h3>
                <p className="reading text-ink-2">{item.body}</p>
              </li>
            ))}
          </ul>
        </PageSection>

        <PageSection id="plans" title={nav('pricing')}>
          <div className="grid gap-3">
            <p className="text-body-lg">
              {c.priceBefore} <Money value={String(lowestPaidPrice())} currency="USD" />{' '}
              {c.priceAfter} <TextLink href="/pricing">{c.comparePlans}</TextLink>
            </p>
            <p className="text-ink-2">
              <BidiText text={c.course} />{' '}
              <TextLink href={{ pathname: '/pricing', hash: 'course' }}>{c.courseLink}</TextLink>
            </p>
          </div>
        </PageSection>

        <section
          aria-labelledby="closing-heading"
          className="grid justify-items-start gap-4 border-t border-hairline py-14"
        >
          <h2 id="closing-heading" className="text-h2 font-bold">
            {c.closingHeading}
          </h2>
          <p className="reading text-ink-2">{c.closingBody}</p>
          <ButtonLink href="/signup">{c.closingAction}</ButtonLink>
        </section>
      </div>

      <JsonLd data={webPageJsonLd(pageInfo(locale, 'home'))} />
      <JsonLd data={applicationJsonLd(locale, 'home')} />
    </>
  );
}
