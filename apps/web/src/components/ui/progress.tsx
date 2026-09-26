/** Teal progress bar that fills from the inline start (the right in Arabic). */
export function Progress({ value, label }: { value: number; label: string }) {
  const percent = Math.round(Math.min(100, Math.max(0, value)));
  return (
    <div className="grid gap-1">
      <div className="flex justify-between gap-4 text-caption text-muted">
        <span>{label}</span>
        <bdi className="num">{percent}%</bdi>
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className="h-1.5 w-full bg-sunken"
      >
        <div className="h-full bg-teal-ink" style={{ inlineSize: `${String(percent)}%` }} />
      </div>
    </div>
  );
}
