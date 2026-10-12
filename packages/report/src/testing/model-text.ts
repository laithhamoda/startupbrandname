import { inlineText } from '../model/inline';
import type { Block, Cell, Inline, ReportModel } from '../model/types';

/*
 * A plain-text reading of a ReportModel for tests and for the person reviewing a golden diff:
 * one line per block or row, numbers and fragments written as they are. Never imported by the
 * application.
 */

const text = (inline: Inline): string => inlineText(inline);

const cellText = (cell: Cell): string => {
  const marks = [cell.lowConfidence ? '!' : '', cell.mark ?? ''].filter((mark) => mark !== '');
  return text(cell.text) + (marks.length > 0 ? ` [${marks.join(',')}]` : '');
};

export function blockLines(block: Block): string[] {
  switch (block.type) {
    case 'paragraph':
    case 'note':
      return [text(block.text)];
    case 'callout':
      return [`(${block.tone}) ${text(block.text)}`];
    case 'list':
      return [
        ...(block.title === null ? [] : [`${text(block.title)}:`]),
        ...block.items.map((item) => `- ${text(item)}`),
      ];
    case 'keyNumbers':
      return block.items.map(
        (item) => `${text(item.label)}: ${cellText(item.value)} (${text(item.caption)})`,
      );
    case 'verdict':
      return [
        `VERDICT ${block.word} ${block.stopSentence ?? ''} | ${text(block.reason)}`,
        ...(block.meter === null ? [] : [text(block.meter.caption)]),
      ];
    case 'table':
      return [
        `TABLE ${text(block.caption)}`,
        `  | ${[block.headHeader === null ? '' : text(block.headHeader), ...block.columns.map((column) => text(column.header))].join(' | ')}`,
        ...[...block.rows, ...(block.total === null ? [] : [block.total])].map(
          (row) =>
            `  | ${[row.head === null ? '' : text(row.head), ...row.cells.map(cellText)].join(' | ')}${row.note === null ? '' : ` // ${text(row.note)}`}`,
        ),
      ];
    case 'definitionList':
      return [
        ...(block.title === null ? [] : [`${text(block.title)}:`]),
        ...block.items.map(
          (item) =>
            `- ${text(item.term)}${item.tag === null ? '' : ` <${item.tag}>`}: ${cellText(item.definition)}${item.label === null ? '' : ` {${item.label.text}}`}${item.url === null ? '' : ` ${item.url}`}`,
        ),
      ];
    case 'canvas':
      return [
        `CANVAS ${block.title}`,
        ...block.blocks.flatMap((cell) => [
          `  ${cell.title}: ${cell.chips.map((chip) => chip.text).join(' / ')}${cell.empty === null ? '' : text(cell.empty)}`,
          ...cell.totals.map((total) => `    ${text(total.label)}: ${cellText(total.value)}`),
        ]),
      ];
    case 'link':
      return [
        `LINK ${text(block.label)} ${block.url}${block.labelText === null ? '' : ` {${block.labelText}}`}`,
      ];
  }
}

/** Every line of a model, section by section. */
export function modelLines(model: ReportModel): string[] {
  return model.sections.flatMap((section) => [
    `## ${section.title}${section.locked ? ' (locked)' : ''}`,
    ...section.blocks.flatMap(blockLines),
  ]);
}

export function modelText(model: ReportModel): string {
  return modelLines(model).join('\n');
}
