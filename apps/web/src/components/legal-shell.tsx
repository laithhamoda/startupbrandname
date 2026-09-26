import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

/**
 * Frame for the legal pages. Every legal text stays marked [LEGAL REVIEW REQUIRED] until a
 * lawyer has reviewed it (SPEC §11, CLAUDE.md §10).
 */
export function LegalShell({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  const t = useTranslations('legal');
  return (
    <article className="mx-auto grid max-w-[75rem] gap-6 px-4 py-12 sm:px-6">
      <header className="grid gap-3">
        <h1 className="text-h1 font-extrabold">{title}</h1>
        <p className="text-small text-muted">
          {t('updated')} <bdi className="num">{updated}</bdi>
        </p>
        <p role="note" className="reading border-s-[3px] border-ink bg-sunken px-4 py-3 text-small">
          {t('draftNotice')}{' '}
          <span lang="en" dir="ltr" className="font-bold">
            [LEGAL REVIEW REQUIRED]
          </span>
        </p>
      </header>
      <div className="reading grid gap-6 [&_h2]:text-h3 [&_h2]:font-bold [&_li]:ms-5 [&_li]:list-disc [&_section]:grid [&_section]:gap-2 [&_ul]:grid [&_ul]:gap-1">
        {children}
      </div>
    </article>
  );
}
