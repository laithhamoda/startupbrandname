import { type Block, inlineText } from '@sbn/report/model';
import { InlineText, type ReportLabels } from './inline';

type VerdictBlock = Extract<Block, { type: 'verdict' }>;

/**
 * The verdict slab (D-274, D-275): true black, the verdict word in gold, the reason in white, the
 * meter of the criteria that passed with the line of "Go" marked in gold, and for a stop the fixed
 * sentence. It carries the page's one orchestrated motion (`data-report-reveal`, globals.css): a
 * reveal on first view, and nothing at all under prefers-reduced-motion.
 */
export function ReportVerdict({ block, labels }: { block: VerdictBlock; labels: ReportLabels }) {
  const meter = block.meter;
  return (
    <section
      aria-label={labels.verdict.label}
      data-report-reveal
      data-verdict={block.code}
      className="grid gap-3 bg-slab p-6 text-slab-text sm:p-8"
    >
      <p className="text-caption text-slab-muted">{labels.verdict.label}</p>
      <p className="verdict-word font-display text-display font-extrabold text-gold">
        {block.word}
      </p>
      {block.stopSentence ? <p className="font-display font-bold">{block.stopSentence}</p> : null}
      <p className="reading">
        <InlineText parts={block.reason} />
      </p>
      {meter ? (
        <div className="grid gap-2 pt-2">
          <div
            role="meter"
            aria-valuemin={0}
            aria-valuemax={meter.evaluated}
            aria-valuenow={meter.passed}
            aria-label={inlineText(meter.caption)}
            aria-valuetext={`${String(meter.passed)} / ${String(meter.evaluated)}`}
            className="relative py-1.5"
          >
            <div aria-hidden className="flex gap-1">
              {Array.from({ length: meter.evaluated }, (_, index) => (
                <i
                  key={index}
                  className={
                    index < meter.passed
                      ? 'block h-2 flex-1 border border-slab-text bg-slab-text'
                      : 'block h-2 flex-1 border border-slab-muted'
                  }
                />
              ))}
            </div>
            <span
              aria-hidden
              style={{ insetInlineStart: `${String(meter.linePercent)}%` }}
              className="absolute inset-y-0 w-[3px] bg-gold"
            />
          </div>
          <p className="text-caption text-slab-text">
            <InlineText parts={meter.caption} />
          </p>
        </div>
      ) : null}
    </section>
  );
}
