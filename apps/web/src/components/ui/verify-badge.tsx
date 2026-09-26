import { useTranslations } from 'next-intl';

interface VerifyBadgeProps {
  /** ISO date of the last check against the official source, shown as given. */
  lastVerified?: string;
  sourceUrl?: string;
}

/** Label for legal, tax or regulatory values that are stale or under review (CLAUDE.md §4 rule 8). */
export function VerifyBadge({ lastVerified, sourceUrl }: VerifyBadgeProps) {
  const t = useTranslations('verify');

  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 border-s-[3px] border-control ps-2 text-caption text-ink-2">
      <span>{t('label')}</span>
      {lastVerified ? (
        <span>
          {t('lastVerified')} <bdi className="num">{lastVerified}</bdi>
        </span>
      ) : null}
      {sourceUrl ? (
        <a
          href={sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-teal-ink underline underline-offset-4"
        >
          {t('source')}
        </a>
      ) : null}
    </span>
  );
}
