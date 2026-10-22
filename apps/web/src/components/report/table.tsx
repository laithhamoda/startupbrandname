import type { Cell, CellMark, Column, Row, TableBlock } from '@sbn/report/model';
import { cn } from '@/lib/cn';
import { CellValue } from './cell';
import { InlineText, type ReportLabels } from './inline';

/** The gold edge of a marked column or cell: a shape and a legend entry, never colour alone. */
const EDGE_TOP = 'shadow-[inset_0_3px_0_0_var(--color-gold)]';
const EDGE_BOTTOM = 'shadow-[inset_0_-3px_0_0_var(--color-gold)]';
/** The wash and outline of a pivotal figure with little confidence behind it (D-229). */
const LOW_CONFIDENCE = 'bg-sunken font-bold outline outline-1 -outline-offset-1 outline-gold-ink';

const CELL_MARK_STYLE: Record<CellMark, string> = {
  lowest_cash: EDGE_BOTTOM,
  break_even: EDGE_TOP,
};

function alignClass(column: Column): string {
  if (column.numeric) return 'text-end tabular-nums whitespace-nowrap';
  if (column.align === 'center') return 'text-center';
  return column.align === 'end' ? 'text-end' : 'text-start';
}

function BodyCell({ cell, column, labels }: { cell: Cell; column: Column; labels: ReportLabels }) {
  return (
    <td
      // A numeric column reads left to right so that its digits, and its decimals, line up.
      dir={column.numeric ? 'ltr' : undefined}
      className={cn(
        'border-b border-hairline px-3 py-2 align-baseline',
        alignClass(column),
        cell.lowConfidence && LOW_CONFIDENCE,
        cell.mark !== null && CELL_MARK_STYLE[cell.mark],
      )}
    >
      <CellValue cell={cell} labels={labels} />
      {cell.mark === 'lowest_cash' ? (
        <span className="sr-only"> ({labels.marks.lowestCash})</span>
      ) : null}
      {cell.mark === 'break_even' ? (
        <span className="sr-only"> ({labels.marks.breakEven})</span>
      ) : null}
    </td>
  );
}

function BodyRow({
  row,
  columns,
  withHead,
  labels,
  total = false,
}: {
  row: Row;
  columns: readonly Column[];
  withHead: boolean;
  labels: ReportLabels;
  total?: boolean;
}) {
  return (
    <tr className={cn(total && 'font-bold')}>
      {withHead ? (
        <th
          scope="row"
          className={cn(
            'sticky start-0 z-[1] min-w-32 bg-paper px-3 py-2 text-start align-baseline',
            total ? 'border-t-2 border-ink' : 'border-b border-hairline font-normal',
          )}
        >
          {row.head ? <InlineText parts={row.head} /> : null}
          {row.note ? (
            <span className="block text-caption font-normal text-muted">
              <InlineText parts={row.note} />
            </span>
          ) : null}
        </th>
      ) : null}
      {row.cells.map((cell, index) => {
        const column = columns[index];
        if (!column) return null;
        return <BodyCell key={index} cell={cell} column={column} labels={labels} />;
      })}
    </tr>
  );
}

/**
 * A table of the model (D-274): a region that scrolls on its own and can be reached by keyboard, a
 * caption, scoped headers, numeric columns drawn left to right and aligned to the end so that the
 * decimals line up, the first column fixed at the inline start while the rest scrolls, the totals
 * row, and a legend for every mark the table uses.
 */
export function ReportTable({
  block,
  id,
  labels,
}: {
  block: TableBlock;
  id: string;
  labels: ReportLabels;
}) {
  const withHead = block.headHeader !== null || block.rows.some((row) => row.head !== null);
  const cells = [...block.rows, ...(block.total ? [block.total] : [])].flatMap((row) => row.cells);
  const legend = [
    cells.some((cell) => cell.lowConfidence)
      ? { key: 'lowConfidence', text: labels.legend.lowConfidence, style: LOW_CONFIDENCE }
      : null,
    cells.some((cell) => cell.mark === 'lowest_cash')
      ? { key: 'lowestCash', text: labels.legend.lowestCash, style: EDGE_BOTTOM }
      : null,
    block.columns.some((column) => column.mark === 'break_even') ||
    cells.some((cell) => cell.mark === 'break_even')
      ? { key: 'breakEven', text: labels.legend.breakEven, style: EDGE_TOP }
      : null,
  ].filter((entry) => entry !== null);

  return (
    <div className="grid gap-2">
      {/* The region scrolls by itself, so a wide table never widens the page (360 px). */}
      <div
        role="region"
        aria-labelledby={`${id}-caption`}
        // Keyboard users must be able to scroll the region (WCAG 2.1.1, axe scrollable-region-focusable).
        // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
        tabIndex={0}
        className="relative overflow-x-auto border-y border-hairline"
      >
        <table className="w-full border-collapse text-small">
          <caption id={`${id}-caption`} className="px-3 py-2 text-start font-display font-bold">
            <InlineText parts={block.caption} />
          </caption>
          <thead>
            <tr>
              {withHead ? (
                <th
                  scope="col"
                  className="sticky start-0 z-[1] bg-sunken px-3 py-2 text-start font-display text-caption font-bold text-muted"
                >
                  {block.headHeader && block.headHeader.length > 0 ? (
                    <InlineText parts={block.headHeader} />
                  ) : (
                    <span className="sr-only">{labels.table.item}</span>
                  )}
                </th>
              ) : null}
              {block.columns.map((column, index) => (
                <th
                  key={index}
                  scope="col"
                  dir={column.numeric ? 'ltr' : undefined}
                  className={cn(
                    'bg-sunken px-3 py-2 align-baseline font-display text-caption font-bold text-muted',
                    alignClass(column),
                    column.mark === 'break_even' && EDGE_TOP,
                  )}
                >
                  <InlineText parts={column.header} />
                  {column.mark === 'break_even' ? (
                    <span className="sr-only"> ({labels.marks.breakEven})</span>
                  ) : null}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row, index) => (
              <BodyRow
                key={index}
                row={row}
                columns={block.columns}
                withHead={withHead}
                labels={labels}
              />
            ))}
          </tbody>
          {block.total ? (
            <tfoot>
              <BodyRow
                row={block.total}
                columns={block.columns}
                withHead={withHead}
                labels={labels}
                total
              />
            </tfoot>
          ) : null}
        </table>
      </div>
      {legend.length > 0 ? (
        <ul
          aria-label={labels.legend.title}
          className="flex flex-wrap gap-x-5 gap-y-1 text-caption"
        >
          {legend.map((entry) => (
            <li key={entry.key} className="inline-flex items-center gap-1.5 text-ink-2">
              <span aria-hidden className={cn('inline-block size-3.5 bg-sunken', entry.style)} />
              {entry.text}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
