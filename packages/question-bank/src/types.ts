/** The eight diagnostic axes (docs/SPEC.md §1). */
export const AXES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as const;
export type Axis = (typeof AXES)[number];

/** Interface and report languages (D-067). Arabic is the reference text. */
export type Language = 'ar' | 'en';
export type Text = Readonly<Record<Language, string>>;

/** A core question ("F3") or a follow-up ("F6.1"). */
export type QuestionId = `${Axis}${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8}`;
export type FollowUpId = `${QuestionId}.${number}`;

export interface Option {
  value: string;
  label: Text;
}

/** A suggested range offered when a number cannot be read (rule R3). */
export interface NumberRange {
  min: number;
  /** Absent for the open-ended top range ("more than 40"). */
  max?: number;
}

/**
 * Field kinds. SPEC §1 lists the base types; the combined ones in its tables ("boolean + text",
 * "3 × number"…) are named kinds here so every answer has one exact shape (#37).
 */
export type Field =
  | { kind: 'short_text'; maxWords?: number; singleSentence?: boolean }
  | { kind: 'long_text'; minWords: number }
  | { kind: 'number'; min: number; max: number; integer: boolean; ranges: readonly NumberRange[] }
  | { kind: 'boolean' }
  | { kind: 'single'; options: readonly Option[] }
  | { kind: 'multi'; options: readonly Option[]; other: boolean }
  | { kind: 'money' }
  | { kind: 'money_range' }
  | { kind: 'currency' }
  | { kind: 'country_city' }
  /** Label, amount and currency per line (F3, F4, F5, E3). */
  | { kind: 'cost_items'; minItems: number }
  /** Label and detail per line: partners and roles (A4), suppliers (E4). */
  | { kind: 'people'; minItems: number; labels: { name: Text; detail: Text } }
  | { kind: 'competitors'; minItems: number }
  | { kind: 'competitor_prices' }
  | { kind: 'percent_split' }
  | { kind: 'yes_no_detail'; detailWhen: 'yes' | 'no'; detailLabel: Text }
  | { kind: 'yes_no_percent'; percentLabel: Text }
  | { kind: 'seasonality' }
  | { kind: 'sales_forecast' }
  | { kind: 'three_texts' }
  | { kind: 'staff_plan' }
  | { kind: 'customer_profile' };

export type FieldKind = Field['kind'];

/** The answer rules of SPEC §2. Which ones a question uses is part of its definition (#38). */
export type RuleId = 'R1' | 'R2' | 'R3' | 'R4' | 'R5' | 'R6' | 'R7' | 'R8';

export interface Question {
  id: QuestionId;
  axis: Axis;
  /** Part of the quick mode (★). Weighs double inside its axis (D-102). */
  star: boolean;
  /** May be skipped without a rule reminder (B6). Still counts in completeness (D-105). */
  optional: boolean;
  /** Accepts «لا أعرف», stored as a low-confidence assumption (R4, D-104). */
  allowUnknown: boolean;
  field: Field;
  label: Text;
  /** A short example or hint shown under the question. */
  help: Text;
  /** Text rules checked on this question's free text. R3, R4 and R6 apply everywhere they can. */
  rules: readonly ('R1' | 'R2' | 'R5' | 'R7' | 'R8')[];
}

export interface FollowUp {
  id: FollowUpId;
  parent: QuestionId;
  field: Field;
  label: Text;
  help: Text;
}
