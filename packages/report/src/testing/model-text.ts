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

/** The inlines of a block in the order a reader meets them. */
export function blockInlines(block: Block): Inline[] {
  switch (block.type) {
    case 'paragraph':
    case 'note':
    case 'callout':
      return [block.text];
    case 'list':
      return [...(block.title === null ? [] : [block.title]), ...block.items];
    case 'keyNumbers':
      return block.items.flatMap((item) => [item.label, item.value.text, item.caption]);
    case 'verdict':
      return [block.reason, ...(block.meter === null ? [] : [block.meter.caption])];
    case 'table':
      return [
        block.caption,
        ...(block.headHeader === null ? [] : [block.headHeader]),
        ...block.columns.map((column) => column.header),
        ...[...block.rows, ...(block.total === null ? [] : [block.total])].flatMap((row) => [
          ...(row.head === null ? [] : [row.head]),
          ...row.cells.map((cell) => cell.text),
          ...(row.note === null ? [] : [row.note]),
        ]),
      ];
    case 'definitionList':
      return [
        ...(block.title === null ? [] : [block.title]),
        ...block.items.flatMap((item) => [item.term, item.definition.text]),
      ];
    case 'canvas':
      return block.blocks.flatMap((cell) => [
        ...(cell.empty === null ? [] : [cell.empty]),
        ...cell.totals.flatMap((total) => [total.label, total.value.text]),
      ]);
    case 'link':
      return [block.label];
  }
}

/** Every inline of a model in reading order. */
export function modelInlines(model: ReportModel): Inline[] {
  return model.sections.flatMap((section) => section.blocks.flatMap(blockInlines));
}

/** Every string anywhere in a value, however deep. */
export function stringsOf(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(stringsOf);
  if (typeof value === 'object' && value !== null) return Object.values(value).flatMap(stringsOf);
  return [];
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
