import { useTranslations } from 'next-intl';

export type Verdict =
  | { kind: 'go'; summary: string }
  | { kind: 'revise'; summary: string }
  // "Stop" always comes with exactly three changes that would change the verdict (CLAUDE.md §3).
  | { kind: 'stop'; changes: readonly [string, string, string] };

/**
 * The report verdict: black and gold in both themes, the one signature element (D-052).
 * `reveal` plays the single orchestrated motion; reduced-motion users see it at rest.
 * The English wording awaits the owner's approval (docs/OPEN-QUESTIONS.md #74).
 */
export function VerdictSlab({ verdict, reveal = false }: { verdict: Verdict; reveal?: boolean }) {
  const t = useTranslations('verdict');

  return (
    <section
      aria-label={t('label')}
      data-reveal={reveal || undefined}
      className="grid gap-3 bg-slab p-6 text-slab-text"
    >
      <span aria-hidden className="verdict-rule block h-0.5 bg-gold" />
      <span className="text-caption text-slab-muted">{t('label')}</span>
      <p className="verdict-word font-display text-h1 font-extrabold text-gold">
        {t(verdict.kind)}
      </p>
      {verdict.kind === 'stop' ? (
        <div className="grid gap-2">
          <p>
            {t('stopPhrase')}. {t('stopChanges')}
          </p>
          <ul className="grid list-disc gap-1 ps-5">
            {verdict.changes.map((change) => (
              <li key={change}>{change}</li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="reading">{verdict.summary}</p>
      )}
    </section>
  );
}
