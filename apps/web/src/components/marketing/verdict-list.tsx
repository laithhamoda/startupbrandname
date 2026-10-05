/**
 * The three possible verdicts on the black slab, gold words: the product's signature element
 * (D-052), described here without any example numbers (D-093).
 */
export function VerdictList({
  label,
  items,
}: {
  label: string;
  items: readonly { word: string; meaning: string }[];
}) {
  return (
    <div className="grid content-start gap-5 bg-slab p-6 text-slab-text sm:p-8">
      <span aria-hidden className="block h-0.5 bg-gold" />
      <p className="text-small text-slab-muted">{label}</p>
      <dl className="grid gap-4">
        {items.map((item) => (
          <div key={item.word} className="grid gap-1">
            <dt className="font-display text-h2 font-extrabold text-gold">{item.word}</dt>
            <dd className="text-small">{item.meaning}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
