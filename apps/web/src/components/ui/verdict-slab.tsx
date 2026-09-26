export type Verdict =
  | { kind: 'go'; summary: string }
  | { kind: 'revise'; summary: string }
  // "Stop" always comes with exactly three changes that would change the verdict (CLAUDE.md §3).
  | { kind: 'stop'; changes: readonly [string, string, string] };

const WORD: Record<Verdict['kind'], string> = { go: 'امضِ', revise: 'عدّل', stop: 'توقّف' };

export const STOP_PHRASE = 'غير قابل للتنفيذ بصيغته الحالية';

/**
 * The report verdict: black and gold in both themes, the one signature element (D-052).
 * `reveal` plays the single orchestrated motion; reduced-motion users see it at rest.
 */
export function VerdictSlab({ verdict, reveal = false }: { verdict: Verdict; reveal?: boolean }) {
  return (
    <section
      aria-label="الحكم"
      data-reveal={reveal || undefined}
      className="grid gap-3 bg-slab p-6 text-slab-text"
    >
      <span aria-hidden className="verdict-rule block h-0.5 bg-gold" />
      <span className="text-caption text-slab-muted">الحكم</span>
      <p className="verdict-word font-display text-h1 font-extrabold text-gold">
        {WORD[verdict.kind]}
      </p>
      {verdict.kind === 'stop' ? (
        <div className="grid gap-2">
          <p>{STOP_PHRASE}. هذه التغييرات الثلاثة تغيّر الحكم:</p>
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
