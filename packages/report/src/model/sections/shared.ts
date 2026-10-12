import type {
  Block,
  CalloutTone,
  Cell,
  Column,
  ColumnAlign,
  Inline,
  Row,
  TableBlock,
} from '../types';

export const paragraph = (text: Inline): Block => ({ type: 'paragraph', text });

export const note = (text: Inline): Block => ({ type: 'note', text });

export const callout = (tone: CalloutTone, text: Inline): Block => ({
  type: 'callout',
  tone,
  text,
});

export const bulletList = (title: Inline | null, items: readonly Inline[]): Block => ({
  type: 'list',
  title,
  ordered: false,
  items,
});

export const column = (
  header: Inline,
  options: {
    readonly align?: ColumnAlign;
    readonly numeric?: boolean;
    readonly mark?: Column['mark'];
  } = {},
): Column => ({
  header,
  align: options.align ?? (options.numeric === true ? 'end' : 'start'),
  numeric: options.numeric ?? false,
  mark: options.mark ?? null,
});

export const row = (
  head: Inline | null,
  cells: readonly Cell[],
  rowNote: Inline | null = null,
): Row => ({
  head,
  note: rowNote,
  cells,
});

export function table(parts: {
  readonly caption: Inline;
  readonly headHeader?: Inline | null;
  readonly columns: readonly Column[];
  readonly rows: readonly Row[];
  readonly total?: Row | null;
}): TableBlock {
  return {
    type: 'table',
    caption: parts.caption,
    headHeader: parts.headHeader ?? null,
    columns: parts.columns,
    rows: parts.rows,
    total: parts.total ?? null,
    numeric: parts.columns.some((entry) => entry.numeric),
  };
}

function cellsOf(block: Block): readonly Cell[] {
  switch (block.type) {
    case 'keyNumbers':
      return block.items.map((item) => item.value);
    case 'table':
      return [...block.rows, ...(block.total === null ? [] : [block.total])].flatMap(
        (entry) => entry.cells,
      );
    case 'definitionList':
      return block.items.map((item) => item.definition);
    case 'canvas':
      return block.blocks.flatMap((entry) => entry.totals.map((total) => total.value));
    default:
      return [];
  }
}

/** Whether any figure of the blocks is a low-confidence pivotal one (D-229). */
export function hasLowConfidence(blocks: readonly Block[]): boolean {
  return blocks.some((block) => {
    if (cellsOf(block).some((entry) => entry.lowConfidence)) return true;
    return (
      block.type === 'canvas' &&
      block.blocks.some((entry) => entry.chips.some((chip) => chip.lowConfidence))
    );
  });
}
