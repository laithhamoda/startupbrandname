import type {
  EngineRun,
  FigureConfidence,
  FigureSource,
  NotCalculableReason,
  PivotalId,
  SuggestedChanges,
  Verdict,
} from '@sbn/engine';
import type { Answers, Gate, Language, StepId } from '@sbn/question-bank';
import type { BlockId, CanvasKind, ChipProvenance, EmptyReason } from '../canvas';
import type { PackItem, PackLabel } from '../legal-path';

/*
 * The report as data (M5 step 5a, D-267). Everything here is a string, a number, a boolean, null,
 * an array or a plain object, so the model crosses to the browser and into a golden file as it is,
 * and carries no HTML: the screen (step 5b) and the print template (step 6) draw it.
 */

/**
 * One piece of a sentence. A string is plain text (the renderer escapes it); `{ n }` is a number or
 * an amount in Western digits with its separators and its sign, which the renderer isolates and
 * draws left to right; `{ l }` is a left-to-right fragment such as a URL, a currency code or an
 * engine tag. An amount is a `{ n }` followed by its currency label, so the label comes after the
 * number (CLAUDE.md section 6).
 */
export type Part = string | { readonly n: string } | { readonly l: string };

/** A sentence or a phrase: the parts in reading order. */
export type Inline = readonly Part[];

/** Where a value comes from and how far it can be trusted (CLAUDE.md rule 2). */
export interface Provenance {
  readonly source: FigureSource;
  readonly confidence: FigureConfidence;
  readonly validated: boolean;
}

/** A table cell can point out a column's meaning inside one row. */
export type CellMark = 'lowest_cash' | 'break_even';

/**
 * A value as the report shows it. `lowConfidence` is true only for the five pivotal figures (F1, F3,
 * F4, F5 and F6) whose confidence is low (D-229): the renderer highlights those and the section
 * carries the sentence once.
 */
export interface Cell {
  readonly text: Inline;
  readonly provenance: Provenance | null;
  readonly lowConfidence: boolean;
  readonly mark: CellMark | null;
}

export interface KeyNumber {
  readonly label: Inline;
  readonly value: Cell;
  readonly caption: Inline;
}

export type ColumnAlign = 'start' | 'end' | 'center';

export interface Column {
  readonly header: Inline;
  readonly align: ColumnAlign;
  /** The column holds numbers: the renderer aligns the digits. */
  readonly numeric: boolean;
  /** The column is the month of the break-even, for a renderer that marks it. */
  readonly mark: 'break_even' | null;
}

export interface Row {
  /** The row's own header cell; null in a table without one. */
  readonly head: Inline | null;
  /** A second, smaller line under the head. */
  readonly note: Inline | null;
  readonly cells: readonly Cell[];
}

export interface Meter {
  readonly passed: number;
  readonly evaluated: number;
  /** Where the line of "Go" stands, in whole percent of the criteria. */
  readonly linePercent: number;
  readonly caption: Inline;
}

export interface TableBlock {
  readonly type: 'table';
  readonly caption: Inline;
  /** The header of the column of row heads. */
  readonly headHeader: Inline | null;
  readonly columns: readonly Column[];
  readonly rows: readonly Row[];
  readonly total: Row | null;
  /** Any column holds numbers. */
  readonly numeric: boolean;
}

/** The official label a pack item carries when it is old, unverified or under review (rule 8). */
export interface LabelText {
  readonly code: PackLabel;
  readonly text: string;
}

export interface DefinitionItem {
  readonly term: Inline;
  readonly definition: Cell;
  /** A short tag such as the role of a guide step; null for none. */
  readonly tag: string | null;
  readonly label: LabelText | null;
  /** A link the item points to; null for none. Always https (the pack validates it). */
  readonly url: string | null;
}

export interface ChipModel {
  readonly key: string;
  readonly questionId: StepId;
  readonly label: string | null;
  /** The founder's own words, plain text. */
  readonly text: string;
  readonly provenance: ChipProvenance;
  readonly lowConfidence: boolean;
}

export interface CanvasCellModel {
  readonly id: BlockId;
  readonly title: string;
  readonly chips: readonly ChipModel[];
  /** Why the block is empty, in words; null when it has chips. */
  readonly empty: Inline | null;
  /** The engine's totals of the cost structure, each labelled. */
  readonly totals: readonly { readonly label: Inline; readonly value: Cell }[];
}

export type CalloutTone = 'low_confidence' | 'tax' | 'adviser' | 'verify' | 'worry' | 'info';

export type Block =
  | { readonly type: 'paragraph'; readonly text: Inline }
  | {
      readonly type: 'list';
      readonly title: Inline | null;
      readonly ordered: boolean;
      readonly items: readonly Inline[];
    }
  | { readonly type: 'keyNumbers'; readonly items: readonly KeyNumber[] }
  | {
      readonly type: 'verdict';
      readonly code: Verdict;
      readonly word: string;
      readonly reason: Inline;
      /** «غير قابل للتنفيذ بصيغته الحالية» for a stop; null otherwise. */
      readonly stopSentence: string | null;
      readonly meter: Meter | null;
    }
  | TableBlock
  | {
      readonly type: 'definitionList';
      readonly title: Inline | null;
      readonly items: readonly DefinitionItem[];
    }
  | {
      readonly type: 'canvas';
      readonly kind: CanvasKind;
      readonly title: string;
      readonly blocks: readonly CanvasCellModel[];
    }
  | { readonly type: 'callout'; readonly tone: CalloutTone; readonly text: Inline }
  | {
      readonly type: 'link';
      readonly label: Inline;
      readonly url: string;
      readonly labelCode: PackLabel | null;
      readonly labelText: string | null;
    }
  | { readonly type: 'note'; readonly text: Inline };

/**
 * The sections the «استراتيجي» report keeps locked (D-314): the canvases, the scenarios and the
 * validation plan stay in «قائد». The assumptions and sources appendices stay open, as every
 * figure shown needs its provenance (CLAUDE.md rule 2, D-316).
 */
export const STANDARD_LOCKED_SECTION_IDS = [
  'canvases',
  'scenarios_sensitivity',
  'validation_plan',
] as const;

/** The sections of the full report, in order (SPEC section 6, the MVP subset, D-236). */
export const FULL_SECTION_IDS = [
  'cover',
  'executive_summary',
  'project_card',
  'canvases',
  'pricing_unit_economics',
  'projection',
  'scenarios_sensitivity',
  'legal_path_financing',
  'validation_plan',
  'appendix_assumptions',
  'appendix_sources',
  'appendix_disclaimer',
] as const;

/** The three sections only the one-page summary has (D-278 added the verdict). */
export const SUMMARY_SECTION_IDS = ['verdict', 'top_risks', 'break_even'] as const;

export type FullSectionId = (typeof FULL_SECTION_IDS)[number];
export type SummarySectionId = (typeof SUMMARY_SECTION_IDS)[number];
export type SectionId = FullSectionId | SummarySectionId;

export interface Section {
  readonly id: SectionId;
  readonly title: string;
  /** A locked section has a title and no blocks: its values were never computed (D-232). */
  readonly locked: boolean;
  readonly blocks: readonly Block[];
}

/** The one-page summary, the «استراتيجي» numbers report (D-314, D-316), or the full report. */
export type ReportKind = 'summary' | 'standard' | 'full';

/** Why a summary has locked sections: the answers are not complete enough, or there is no plan. */
export type LockReason = 'completeness' | 'plan';

/** Who the report is shown to (H8). `self` when unanswered (D-236). */
export type Audience = 'investor' | 'bank' | 'grant' | 'course' | 'self';

export interface ConfidenceMeta {
  readonly level: FigureConfidence;
  readonly sound: number;
  readonly pivotal: readonly {
    readonly id: PivotalId;
    readonly level: FigureConfidence | 'missing';
    readonly sound: boolean;
  }[];
}

export interface ReportMeta {
  readonly title: string;
  readonly countryCode: string;
  readonly currencyLabel: string;
  readonly issuedOn: string;
  /** Null for a summary without a calculable run. */
  readonly engineVersion: string | null;
  readonly inputHash: string | null;
  readonly completeness: { readonly percent: number; readonly gate: Gate };
  /** Null without a calculable run. */
  readonly confidence: ConfidenceMeta | null;
}

export interface ReportModel {
  readonly version: 1;
  readonly locale: Language;
  readonly kind: ReportKind;
  readonly lockReason: LockReason | null;
  readonly audience: Audience;
  readonly meta: ReportMeta;
  readonly sections: readonly Section[];
}

/** What the builder reads. The caller decides `kind` and `lockReason` from the gate and the plan. */
export interface ReportInput {
  readonly locale: Language;
  readonly kind: ReportKind;
  readonly lockReason: LockReason | null;
  readonly audience: Audience;
  readonly project: {
    readonly title: string;
    readonly countryCode: string;
    readonly currency: string;
    readonly currencyLabel: string;
  };
  readonly answers: Answers;
  readonly provenance: Partial<Record<StepId, ChipProvenance & { readonly pickedRange?: boolean }>>;
  /** The engine's run; null when the answers cannot be calculated yet (a summary only). */
  readonly run: EngineRun | null;
  /** Why `run` is null. */
  readonly notCalculable?: readonly NotCalculableReason[];
  readonly changes: SuggestedChanges | null;
  readonly packItems: readonly PackItem[];
  readonly completeness: { readonly percent: number; readonly gate: Gate };
  /** `YYYY-MM-DD`: the day the report is made. */
  readonly today: string;
  readonly inputHash?: string | null;
}

export type ReportModelErrorCode =
  | 'run_required'
  | 'lock_reason_required'
  | 'lock_reason_unexpected'
  | 'invalid_date'
  | 'currency_mismatch';

/** A caller error: the input cannot make the report it asked for. */
export class ReportModelError extends Error {
  readonly code: ReportModelErrorCode;

  constructor(code: ReportModelErrorCode, message: string) {
    super(message);
    this.name = 'ReportModelError';
    this.code = code;
  }
}

export type { EmptyReason };
