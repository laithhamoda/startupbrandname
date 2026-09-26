export type ProvenanceSource = 'user' | 'assumption' | 'external';

const LABEL: Record<ProvenanceSource, string> = {
  user: 'إجابتك',
  assumption: 'افتراض',
  external: 'مصدر خارجي',
};

// Shape plus text, never colour alone: solid dot, dashed ring, teal diamond (CLAUDE.md §4 rule 2).
const MARKER: Record<ProvenanceSource, string> = {
  user: 'size-2 rounded-pill bg-ink',
  assumption: 'size-2 rounded-pill border-[1.5px] border-dashed border-ink-2',
  external: 'size-[7px] rotate-45 bg-teal-ink',
};

export function ProvenanceTag({ source }: { source: ProvenanceSource }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-pill border border-control px-2.5 py-0.5 text-caption text-ink-2">
      <span aria-hidden className={`inline-block ${MARKER[source]}`} />
      {LABEL[source]}
    </span>
  );
}
