import type { Cell, Provenance } from '@sbn/report/model';
import { CircleAlert } from 'lucide-react';
import { ProvenanceMark } from '@/components/ui/provenance-tag';
import { InlineText, type ReportLabels } from './inline';

/** What the three provenance fields say, in words (CLAUDE.md rule 2): for those who cannot see the mark. */
export function provenanceWords(provenance: Provenance, labels: ReportLabels): string {
  return [
    labels.marks.source[provenance.source],
    labels.marks.confidence[provenance.confidence],
    labels.marks.validated[provenance.validated ? 'yes' : 'no'],
  ].join(labels.marks.separator);
}

/**
 * A value as the report shows it, with its provenance mark and in words, and, for a pivotal figure
 * the owner has little confidence in, a marker and its words: shape and text, never colour alone
 * (D-229, D-274). The wash behind the cell and the outline belong to the table cell that holds it.
 */
export function CellValue({ cell, labels }: { cell: Cell; labels: ReportLabels }) {
  return (
    <>
      {cell.provenance ? (
        <>
          <ProvenanceMark source={cell.provenance.source} />{' '}
        </>
      ) : null}
      <InlineText parts={cell.text} />
      {cell.lowConfidence ? (
        <>
          {' '}
          <CircleAlert aria-hidden className="inline size-3.5 align-text-bottom text-gold-ink" />
          <span className="sr-only">{labels.marks.lowConfidence}</span>
        </>
      ) : null}
      {cell.provenance ? (
        <span className="sr-only"> ({provenanceWords(cell.provenance, labels)})</span>
      ) : null}
    </>
  );
}
