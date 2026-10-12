import type { Answers, Language, StepId } from '@sbn/question-bank';

/** The two canvases of M5 (SPEC T1 and T2, D-231). */
export type CanvasKind = 'business_model' | 'lean';

/**
 * Every block of the two canvases. Four are shared by name (customer segments, channels, revenue
 * streams, cost structure); each canvas lists its own nine.
 */
export type BlockId =
  | 'customerSegments'
  | 'valuePropositions'
  | 'channels'
  | 'customerRelationships'
  | 'revenueStreams'
  | 'keyResources'
  | 'keyActivities'
  | 'keyPartners'
  | 'costStructure'
  | 'problem'
  | 'solution'
  | 'keyMetrics'
  | 'uniqueValueProposition'
  | 'unfairAdvantage';

/** One answer that feeds a block. `items` marks a list answer: one chip for each of its lines. */
export interface BlockSource {
  readonly id: StepId;
  readonly items?: true;
}

export interface BlockDefinition {
  readonly id: BlockId;
  readonly sources: readonly BlockSource[];
}

/**
 * Where an answer comes from and how far it can be trusted (CLAUDE.md rule 2): the three values
 * the database stores next to it. Plain strings and a flag, so the model crosses to the browser.
 */
export interface ChipProvenance {
  readonly source: 'user' | 'assumption' | 'external';
  readonly confidence: 'high' | 'medium' | 'low';
  readonly validated: boolean;
}

/** An answer without a stored provenance is an assumption nobody has checked (rule 2). */
export const ASSUMED: ChipProvenance = {
  source: 'assumption',
  confidence: 'low',
  validated: false,
};

/**
 * One answer, or one line of a list answer, as the founder gave it. `text` is the founder's own
 * words, or their number with the currency after it; `label` is the founder's name for a line of
 * a list (a cost item, a supplier, a role). Nothing here is written by the platform (rule 9).
 */
export interface CanvasChip {
  /** Stable among the chips of a block: the question, and the line for a list answer. */
  readonly key: string;
  /** The question or follow-up the chip edits (rule 3). */
  readonly questionId: StepId;
  readonly label: string | null;
  readonly text: string;
  readonly provenance: ChipProvenance;
}

/**
 * Why a source gave no chip: never answered, answered «لا أعرف», or answered with nothing listed.
 */
export type GapState = 'unanswered' | 'unknown' | 'empty';

export interface CanvasGap {
  readonly questionId: StepId;
  readonly state: GapState;
}

/** Why a block shows no chip. `no_question` is a block with no question behind it (D-231). */
export type EmptyReason = GapState | 'no_question';

/** A number the engine computed for the cost structure, already written for the page (rule 1). */
export interface CanvasTotal {
  readonly kind: 'fixedMonthly' | 'variableUnit' | 'setup';
  /** The amount with its currency after it. */
  readonly text: string;
  readonly provenance: ChipProvenance;
}

export interface CanvasBlock {
  readonly id: BlockId;
  readonly chips: readonly CanvasChip[];
  /** Sources that gave no chip, in the order of the map. The first one fills an empty block. */
  readonly gaps: readonly CanvasGap[];
  /** Set exactly when `chips` is empty. */
  readonly reason: EmptyReason | null;
  /** The engine's totals: only on the cost structure, and only when the run is calculable. */
  readonly totals: readonly CanvasTotal[];
}

export interface CanvasModel {
  readonly kind: CanvasKind;
  /** The nine blocks in filling order, starting with the customer segments. */
  readonly blocks: readonly CanvasBlock[];
}

/** What a canvas is built from: the stored answers with their provenance, and the page language. */
export interface CanvasInput {
  readonly language: Language;
  readonly answers: Answers;
  /** The stored provenance of each answered step; a step without one is an assumption. */
  readonly provenance: Partial<Record<StepId, ChipProvenance>>;
  /** The label written after an amount: "د.أ" or "JOD". The page decides, from its messages. */
  readonly currencyLabel: (code: string) => string;
  /** The engine's totals, empty when the run cannot be calculated. */
  readonly totals?: readonly CanvasTotal[];
}
