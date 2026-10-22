import type { ReportMessages } from '../messages/types';
import { inlineText } from '../model/inline';
import type {
  Block,
  CanvasCellModel,
  Cell,
  ChipModel,
  Column,
  DefinitionItem,
  Inline,
  KeyNumber,
  Row,
  TableBlock,
} from '../model/types';
import { isolatedLatin, isolatedNumber } from './document';
import { escapeHtml } from './escape';
import { directionOf, type PrintLocale } from './locale';

/*
 * The blocks of a ReportModel as print HTML (M5 step 6, D-279). Every founder-controlled string
 * goes through escapeHtml, and every markup character here is written by this file: nothing is
 * built from raw model text, no model text reaches a style, a header or an attribute that can run
 * (D-235). The only values placed in an attribute are an https address that `URL` parsed and an
 * escaped label, and the only number placed in a style is an integer clamped to 0..100.
 */

export interface PrintContext {
  readonly locale: PrintLocale;
  readonly m: ReportMessages;
}

/** A sentence: text escaped, numbers and amounts isolated, left-to-right fragments fixed. */
export function inlineHtml(inline: Inline): string {
  return inline
    .map((part) => {
      if (typeof part === 'string') return escapeHtml(part);
      return 'n' in part ? isolatedNumber(part.n) : isolatedLatin(part.l);
    })
    .join('');
}

/**
 * A value. A figure the founder has little confidence in carries an asterisk: paper has no hover,
 * so the asterisk, the legend of the model's own callout and the assumptions appendix show where a
 * figure comes from (D-229).
 */
export function cellHtml(cell: Cell): string {
  return inlineHtml(cell.text) + (cell.lowConfidence ? '<sup class="lc">*</sup>' : '');
}

/** The address when it is a well-formed https one, else null: only those become links. */
function httpsHref(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' ? parsed.href : null;
  } catch {
    return null;
  }
}

/** A web address as text, and as a link when it is https. It is shown because paper cannot click. */
function addressHtml(url: string): string {
  const href = httpsHref(url);
  const text = `<bdi dir="ltr" class="url">${escapeHtml(url)}</bdi>`;
  return href === null ? text : `<a href="${escapeHtml(href)}">${text}</a>`;
}

const chipHtml = (text: string): string => `<span class="chip">${escapeHtml(text)}</span>`;

function columnClass(column: Column | undefined): string {
  if (column === undefined) return '';
  if (column.numeric) return 'num';
  if (column.align === 'center') return 'hc';
  return column.align === 'end' ? 'ta-end' : '';
}

const attr = (classes: readonly string[]): string => {
  const joined = classes.filter((name) => name !== '').join(' ');
  return joined === '' ? '' : ` class="${joined}"`;
};

function bodyCellHtml(cell: Cell, column: Column | undefined): string {
  const classes = [
    columnClass(column),
    cell.mark === 'lowest_cash' ? 'low' : '',
    cell.mark === 'break_even' ? 'be' : '',
    cell.lowConfidence ? 'lcf' : '',
  ];
  return `<td${attr(classes)}>${cellHtml(cell)}</td>`;
}

function rowHtml(row: Row, columns: readonly Column[], withHead: boolean, total: boolean): string {
  const head = withHead
    ? `<th scope="row">${row.head === null ? '' : inlineHtml(row.head)}${
        row.note === null ? '' : `<span class="sub">${inlineHtml(row.note)}</span>`
      }</th>`
    : '';
  const cells = row.cells.map((cell, index) => bodyCellHtml(cell, columns[index])).join('');
  return `<tr${attr([total ? 'tot' : ''])}>${head}${cells}</tr>`;
}

/** A table with more columns than this is set small, as the mock's twelve-month table is. */
const DENSE_COLUMNS = 7;

/** A table of up to this many rows stays whole on a page; a longer one (an appendix) may break between rows. */
const KEEP_ROWS = 12;

export function tableHtml(block: TableBlock): string {
  const dense = block.columns.length >= DENSE_COLUMNS;
  const withHead = block.headHeader !== null || block.rows.some((row) => row.head !== null);
  const headCells = block.columns
    .map(
      (column) =>
        `<th scope="col"${attr([columnClass(column), column.mark === 'break_even' ? 'be' : ''])}>${inlineHtml(column.header)}</th>`,
    )
    .join('');
  const corner = withHead
    ? `<th scope="col">${block.headHeader === null ? '' : inlineHtml(block.headHeader)}</th>`
    : '';
  const body = [
    ...block.rows.map((row) => rowHtml(row, block.columns, withHead, false)),
    ...(block.total === null ? [] : [rowHtml(block.total, block.columns, withHead, true)]),
  ].join('');
  const caption =
    block.caption.length === 0 ? '' : `<caption>${inlineHtml(block.caption)}</caption>`;
  return (
    `<table${attr(['tbl', dense ? 'dense' : '', block.rows.length <= KEEP_ROWS ? 'keep' : ''])}>${caption}` +
    `<thead><tr>${corner}${headCells}</tr></thead><tbody>${body}</tbody></table>`
  );
}

function keyNumberHtml(item: KeyNumber): string {
  return (
    `<div class="kpi"><div class="klabel">${inlineHtml(item.label)}</div>` +
    `<div class="value">${cellHtml(item.value)}</div>` +
    `<div class="caption">${inlineHtml(item.caption)}</div></div>`
  );
}

type VerdictBlock = Extract<Block, { type: 'verdict' }>;

const percent = (value: number): number => Math.min(100, Math.max(0, Math.round(value)));

/** The slab: black, the word in gold, the reason and the meter in white, the line of "Go" in gold. */
function verdictHtml(block: VerdictBlock, ctx: PrintContext): string {
  const meter = block.meter;
  const cells =
    meter === null
      ? ''
      : Array.from({ length: Math.max(0, Math.min(40, meter.evaluated)) }, (_, index) =>
          index < meter.passed ? '<i class="on"></i>' : '<i></i>',
        ).join('');
  const meterHtml =
    meter === null
      ? ''
      : `<div class="meter" role="img" aria-label="${escapeHtml(inlineText(meter.caption))}">` +
        `<div class="cells">${cells}</div>` +
        `<span class="tick" style="inset-inline-start:${String(percent(meter.linePercent))}%"></span></div>` +
        `<p class="mcap">${inlineHtml(meter.caption)}</p>`;
  return (
    `<div class="slab" data-verdict="${block.code}">` +
    `<div class="label">${escapeHtml(ctx.m.sections.verdict)}</div>` +
    `<div class="verdict">${escapeHtml(block.word)}</div>` +
    (block.stopSentence === null ? '' : `<p class="stop">${escapeHtml(block.stopSentence)}</p>`) +
    `<p class="reason">${inlineHtml(block.reason)}</p>${meterHtml}</div>`
  );
}

function definitionItemHtml(item: DefinitionItem): string {
  const tag = item.tag === null ? '' : chipHtml(item.tag);
  const label = item.label === null ? '' : chipHtml(item.label.text);
  const address = item.url === null ? '' : addressHtml(item.url);
  return (
    `<div class="def"><dt>${inlineHtml(item.term)}${tag}</dt>` +
    `<dd>${cellHtml(item.definition)}${label}${address}</dd></div>`
  );
}

function definitionListHtml(title: Inline | null, items: readonly DefinitionItem[]): string {
  return (
    `<div class="defs">${title === null ? '' : `<h3>${inlineHtml(title)}</h3>`}` +
    `<dl>${items.map(definitionItemHtml).join('')}</dl></div>`
  );
}

function chipsHtml(chip: ChipModel): string {
  const label =
    chip.label === null ? '' : `<span class="clabel" dir="auto">${escapeHtml(chip.label)}</span>`;
  const star = chip.lowConfidence ? '<sup class="lc">*</sup>' : '';
  return `<li>${label}<span dir="auto">${escapeHtml(chip.text)}</span>${star}</li>`;
}

/** The blocks of both canvases that have a place on the board (CSS `.cv-*`). */
const BOARD_BLOCKS: ReadonlySet<string> = new Set([
  'keyPartners',
  'keyActivities',
  'keyResources',
  'valuePropositions',
  'customerRelationships',
  'channels',
  'customerSegments',
  'costStructure',
  'revenueStreams',
  'problem',
  'solution',
  'keyMetrics',
  'uniqueValueProposition',
  'unfairAdvantage',
]);

function canvasCellHtml(cell: CanvasCellModel, ctx: PrintContext): string {
  const place = BOARD_BLOCKS.has(cell.id) ? ` cv-${cell.id}` : '';
  const content =
    cell.chips.length > 0
      ? `<ul>${cell.chips.map(chipsHtml).join('')}</ul>`
      : cell.empty === null
        ? ''
        : `<p class="empty">${inlineHtml(cell.empty)}</p>`;
  const totals =
    cell.totals.length === 0
      ? ''
      : `<dl>${cell.totals
          .map(
            (total) =>
              `<div><dt>${inlineHtml(total.label)}</dt><dd>${cellHtml(total.value)}</dd></div>`,
          )
          .join('')}</dl>`;
  return (
    `<section class="cvc${place}" dir="${directionOf(ctx.locale)}">` +
    `<h4>${escapeHtml(cell.title)}</h4>${content}${totals}</section>`
  );
}

/** A canvas in the standard geometry: the board reads left to right, the words in a box in the page direction. */
function canvasHtml(block: Extract<Block, { type: 'canvas' }>, ctx: PrintContext): string {
  return (
    `<div class="canvas"><h3>${escapeHtml(block.title)}</h3>` +
    `<div class="board" dir="ltr">${block.blocks.map((cell) => canvasCellHtml(cell, ctx)).join('')}</div></div>`
  );
}

/** Which legend line explains the mark on a table, found by the words the model wrote for it. */
type LegendKind = 'low' | 'be';

function columnOfCellMark(block: TableBlock, mark: 'lowest_cash' | 'break_even'): number {
  for (const row of block.rows) {
    const index = row.cells.findIndex((cell) => cell.mark === mark);
    if (index >= 0) return index;
  }
  return -1;
}

/**
 * The model gives the legend of a marked table as the notes right after it. Print draws the swatch
 * of the mark in front of the note that explains it: the lowest-cash note is found by its exact
 * words, the break-even note is the first other note that names the marked month.
 */
function legendKinds(blocks: readonly Block[], ctx: PrintContext): Map<number, LegendKind> {
  const found = new Map<number, LegendKind>();
  blocks.forEach((block, index) => {
    if (block.type !== 'table') return;
    const lowest = block.columns[columnOfCellMark(block, 'lowest_cash')];
    const breakEven = block.columns.find((column) => column.mark === 'break_even');
    if (lowest === undefined && breakEven === undefined) return;
    const lowestText =
      lowest === undefined
        ? null
        : inlineText(ctx.m.projection.legendLowest({ month: ctx.m.month({ n: lowest.header }) }));
    const breakEvenMonth =
      breakEven === undefined ? null : inlineText(ctx.m.month({ n: breakEven.header }));
    let breakEvenFound = false;
    for (let at = index + 1; at < blocks.length; at += 1) {
      const next = blocks[at];
      if (next?.type !== 'note') break;
      const text = inlineText(next.text);
      if (lowestText !== null && text === lowestText) found.set(at, 'low');
      else if (!breakEvenFound && breakEvenMonth !== null && text.includes(breakEvenMonth)) {
        found.set(at, 'be');
        breakEvenFound = true;
      }
    }
  });
  return found;
}

function calloutHtml(block: Extract<Block, { type: 'callout' }>): string {
  const text = inlineHtml(block.text);
  switch (block.tone) {
    case 'tax':
    case 'adviser':
      return `<div class="taxbox" role="note">${text}</div>`;
    case 'worry':
      return `<blockquote class="user-text plain">${text}</blockquote>`;
    case 'low_confidence':
      return `<p class="callout lcnote" role="note"><sup class="lc">*</sup> ${text}</p>`;
    case 'verify':
    case 'info':
      return `<p class="callout" role="note">${text}</p>`;
  }
}

function linkHtml(block: Extract<Block, { type: 'link' }>): string {
  const label = inlineHtml(block.label);
  const href = httpsHref(block.url);
  const text = href === null ? label : `<a href="${escapeHtml(href)}">${label}</a>`;
  return (
    `<p class="link">${text} ${addressHtml(block.url)}` +
    `${block.labelText === null ? '' : chipHtml(block.labelText)}</p>`
  );
}

function listHtml(block: Extract<Block, { type: 'list' }>): string {
  const tag = block.ordered ? 'ol' : 'ul';
  return (
    (block.title === null ? '' : `<h3>${inlineHtml(block.title)}</h3>`) +
    `<${tag} class="points">${block.items.map((item) => `<li>${inlineHtml(item)}</li>`).join('')}</${tag}>`
  );
}

/** One block as HTML. `legend` is set for a note that explains a mark on the table above it. */
export function blockHtml(block: Block, ctx: PrintContext, legend?: LegendKind): string {
  switch (block.type) {
    case 'paragraph':
      return `<p>${inlineHtml(block.text)}</p>`;
    case 'note':
      return `<p${attr(['note', legend === undefined ? '' : `legend ${legend}`])}>${inlineHtml(block.text)}</p>`;
    case 'list':
      return listHtml(block);
    case 'keyNumbers':
      return `<div class="kpis">${block.items.map(keyNumberHtml).join('')}</div>`;
    case 'verdict':
      return verdictHtml(block, ctx);
    case 'table':
      return tableHtml(block);
    case 'definitionList':
      return definitionListHtml(block.title, block.items);
    case 'canvas':
      return canvasHtml(block, ctx);
    case 'callout':
      return calloutHtml(block);
    case 'link':
      return linkHtml(block);
  }
}

/** The empty line a person fills in by hand, and the three boxes of the decision. */
function fillsHtml(ctx: PrintContext): string {
  const words = ctx.m.print.fill;
  const option = (label: string): string =>
    `<span class="opt"><span class="box"></span>${escapeHtml(label)}</span>`;
  return (
    '<div class="fills">' +
    `<div class="fill"><span>${escapeHtml(words.success)}</span><i></i></div>` +
    `<div class="fill"><span>${escapeHtml(words.result)}</span><i></i></div>` +
    `<div class="fill dec"><span>${escapeHtml(words.decision)}</span>` +
    `${option(words.go)}${option(words.revise)}${option(words.stop)}</div></div>`
  );
}

type DefinitionBlock = Extract<Block, { type: 'definitionList' }>;

/**
 * One experiment of the validation plan as the mock draws it: the title and the cost on one side,
 * the founder's worry, the reason, the test and the fallback on the other, and under them the strip
 * to fill in by hand. The fill-in strip exists on paper only (OPEN-QUESTIONS #100).
 */
function experimentHtml(
  worry: Extract<Block, { type: 'callout' }> | null,
  list: DefinitionBlock,
  ctx: PrintContext,
): string {
  const labels = ctx.m.validation.labels;
  const isLabel = (item: DefinitionItem, label: string): boolean => inlineText(item.term) === label;
  const cost = list.items.find((item) => isLabel(item, labels.cost));
  const rest = list.items.filter((item) => item !== cost);
  const lines = rest
    .map((item) =>
      isLabel(item, labels.why)
        ? `<p class="why">${cellHtml(item.definition)}</p>`
        : `<p><b>${inlineHtml(item.term)}:</b> ${cellHtml(item.definition)}</p>`,
    )
    .join('');
  const costHtml =
    cost === undefined
      ? ''
      : `<span class="cost">${inlineHtml(cost.term)}: ${cellHtml(cost.definition)}</span>`;
  return (
    '<div class="exp"><div class="who">' +
    `${list.title === null ? '' : `<h3>${inlineHtml(list.title)}</h3>`}${costHtml}</div>` +
    `<div class="what">${worry === null ? '' : calloutHtml(worry)}${lines}${fillsHtml(ctx)}</div></div>`
  );
}

/** The blocks of the validation plan: each experiment, with the worry that opens it, becomes one. */
function validationHtml(blocks: readonly Block[], ctx: PrintContext): string {
  const out: string[] = [];
  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index];
    if (block === undefined) continue;
    const next = blocks[index + 1];
    if (block.type === 'callout' && block.tone === 'worry' && next?.type === 'definitionList') {
      out.push(experimentHtml(block, next, ctx));
      index += 1;
    } else if (block.type === 'definitionList') {
      out.push(experimentHtml(null, block, ctx));
    } else {
      out.push(blockHtml(block, ctx));
    }
  }
  return out.join('');
}

/** The blocks of a section, in order. */
export function blocksHtml(
  blocks: readonly Block[],
  ctx: PrintContext,
  options: { readonly experiments?: boolean } = {},
): string {
  if (options.experiments === true) return validationHtml(blocks, ctx);
  const legends = legendKinds(blocks, ctx);
  return blocks.map((block, index) => blockHtml(block, ctx, legends.get(index))).join('');
}
