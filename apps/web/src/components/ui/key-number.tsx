interface KeyNumberProps {
  label: string;
  /** Already formatted by the engine; this component never computes (CLAUDE.md §4 rule 1). */
  value: string;
  unit?: string;
  /** Put the unit before the number, as in "الشهر 14". Currency always goes after. */
  unitFirst?: boolean;
}

export function KeyNumber({ label, value, unit, unitFirst = false }: KeyNumberProps) {
  const unitLabel = unit ? (
    <span className="text-body font-semibold text-ink-2">{unit}</span>
  ) : null;
  return (
    <div className="grid gap-0.5">
      <span className="text-caption text-muted">{label}</span>
      <span className="flex items-baseline gap-1.5 font-display text-h2 font-extrabold text-gold-ink">
        {unitFirst ? unitLabel : null}
        <bdi className="num">{value}</bdi>
        {unitFirst ? null : unitLabel}
      </span>
    </div>
  );
}
