import type { Block, CanvasCellModel, ChipModel } from '@sbn/report/model';
import { CircleAlert } from 'lucide-react';
import { PLACEMENT } from '@/components/canvas/canvas-board';
import { ProvenanceMark } from '@/components/ui/provenance-tag';
import { cn } from '@/lib/cn';
import { CellValue, provenanceWords } from './cell';
import { InlineText, type ReportLabels } from './inline';

type CanvasBlockModel = Extract<Block, { type: 'canvas' }>;

function Chip({ chip, labels }: { chip: ChipModel; labels: ReportLabels }) {
  return (
    <li className="grid gap-0.5 border-s-2 border-hairline py-1 ps-3">
      {chip.label ? (
        // The founder's own words, in any script: their own direction.
        <span dir="auto" className="text-caption font-bold text-ink-2">
          {chip.label}
        </span>
      ) : null}
      <span dir="auto" className="flex items-start gap-1.5 text-small">
        <span className="mt-2.5 shrink-0">
          <ProvenanceMark source={chip.provenance.source} />
        </span>
        <span>
          {chip.text}
          {chip.lowConfidence ? (
            <>
              {' '}
              <CircleAlert
                aria-hidden
                className="inline size-3.5 align-text-bottom text-gold-ink"
              />
              <span className="sr-only">{labels.marks.lowConfidence}</span>
            </>
          ) : null}
          <span className="sr-only"> ({provenanceWords(chip.provenance, labels)})</span>
        </span>
      </span>
    </li>
  );
}

function CanvasCell({
  cell,
  placement,
  headingId,
  dir,
  labels,
}: {
  cell: CanvasCellModel;
  placement: string | undefined;
  headingId: string;
  dir: 'ltr' | 'rtl';
  labels: ReportLabels;
}) {
  return (
    <section
      aria-labelledby={headingId}
      // The board is laid out left to right; the words in a box read in the page direction.
      dir={dir}
      className={cn('flex min-w-0 flex-col gap-3 bg-paper p-4', placement)}
    >
      <h4 id={headingId} className="font-display text-small font-bold">
        {cell.title}
      </h4>
      {cell.chips.length > 0 ? (
        <ul className="grid gap-1.5">
          {cell.chips.map((chip) => (
            <Chip key={chip.key} chip={chip} labels={labels} />
          ))}
        </ul>
      ) : cell.empty ? (
        <p className="text-small text-muted">
          <InlineText parts={cell.empty} />
        </p>
      ) : null}
      {cell.totals.length > 0 ? (
        <div className="mt-1 grid gap-1.5 border-t border-hairline pt-3">
          <p className="text-caption text-muted">{labels.canvas.totals}</p>
          <dl className="grid gap-1.5">
            {cell.totals.map((total, index) => (
              <div key={index} className="grid gap-0.5">
                <dt className="text-caption text-ink-2">
                  <InlineText parts={total.label} />
                </dt>
                <dd className="font-display text-small font-extrabold text-gold-ink">
                  <CellValue cell={total.value} labels={labels} />
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}
    </section>
  );
}

/**
 * A canvas of the model, read only (D-274): the standard geometry of the canvas board (a board
 * drawn left to right in both languages, customer segments rightmost), with the founder's own
 * words, their provenance marks and the reason a box is empty in words. No links: the report is
 * not where an answer is edited.
 */
export function ReportCanvas({
  block,
  id,
  locale,
  labels,
}: {
  block: CanvasBlockModel;
  id: string;
  locale: 'ar' | 'en';
  labels: ReportLabels;
}) {
  const placement = PLACEMENT[block.kind];
  return (
    <div className="grid gap-3">
      <h3 className="font-display text-body font-bold">{block.title}</h3>
      <div dir="ltr" className="grid gap-px border border-hairline bg-hairline lg:grid-cols-10">
        {block.blocks.map((cell) => (
          <CanvasCell
            key={cell.id}
            cell={cell}
            placement={placement[cell.id]}
            headingId={`${id}-${cell.id}`}
            dir={locale === 'ar' ? 'rtl' : 'ltr'}
            labels={labels}
          />
        ))}
      </div>
    </div>
  );
}
