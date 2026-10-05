import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { Link } from '@/i18n/navigation';
import { BidiText } from './bidi-text';

/** Home › current page. The matching BreadcrumbList structured data is added by the page. */
export function Breadcrumbs({ current }: { current: string }) {
  const t = useTranslations('breadcrumbs');
  return (
    <nav aria-label={t('label')}>
      <ol className="flex flex-wrap items-center gap-x-2 text-small text-muted">
        <li>
          <Link href="/" className="text-ink-2 underline underline-offset-4 hover:no-underline">
            {t('home')}
          </Link>
        </li>
        <li aria-hidden>/</li>
        <li aria-current="page">{current}</li>
      </ol>
    </nav>
  );
}

/** Opening of an inner public page: breadcrumbs, the one h1 and a lead paragraph. */
export function PageIntro({
  title,
  lead,
  children,
}: {
  title: string;
  lead: string;
  children?: ReactNode;
}) {
  return (
    <header className="grid gap-4 pb-10">
      <Breadcrumbs current={title} />
      <h1 className="text-h1 font-extrabold">{title}</h1>
      <p className="reading text-body-lg text-ink-2">
        <BidiText text={lead} />
      </p>
      {children}
    </header>
  );
}

/** Page frame shared by the public pages: width, gutters and vertical rhythm. */
export function PageBody({ children }: { children: ReactNode }) {
  return <div className="mx-auto max-w-[75rem] px-4 py-12 sm:px-6 sm:py-16">{children}</div>;
}

/** A titled part of a page, separated by a hairline rather than a card (M1 design plan). */
export function PageSection({
  id,
  title,
  lead,
  children,
}: {
  /** Also the anchor for links to this part of the page. */
  id: string;
  title: string;
  lead?: string;
  children: ReactNode;
}) {
  const headingId = `${id}-heading`;
  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className="grid scroll-mt-6 gap-5 border-t border-hairline py-10"
    >
      <h2 id={headingId} className="text-h2 font-bold">
        {title}
      </h2>
      {lead ? (
        <p className="reading text-ink-2">
          <BidiText text={lead} />
        </p>
      ) : null}
      {children}
    </section>
  );
}
