import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface Column {
  key: string;
  header: string;
  numeric?: boolean;
}

interface NumericTableProps {
  caption: string;
  columns: readonly Column[];
  rows: readonly { id: string; cells: Readonly<Record<string, ReactNode>> }[];
}

/**
 * Financial table. Numeric cells use equal-width digits and align to the inline start, so the
 * decimal separators line up when values share a precision (CLAUDE.md §6).
 */
export function NumericTable({ caption, columns, rows }: NumericTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-small">
        <caption className="pb-2 text-start font-display font-bold">{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className="border-b border-control px-3 py-2 text-start font-display text-caption font-bold text-muted"
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              {columns.map((column, index) => {
                const className = cn(
                  'border-b border-hairline px-3 py-2 text-start',
                  // Equal-width digits only; the cell stays RTL so the currency follows the number.
                  column.numeric && 'tabular-nums whitespace-nowrap',
                );
                return index === 0 ? (
                  <th key={column.key} scope="row" className={cn(className, 'font-normal')}>
                    {row.cells[column.key]}
                  </th>
                ) : (
                  <td key={column.key} className={className}>
                    {row.cells[column.key]}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
