import { readCurrency } from './currency';
import type { Answer } from './fields';
import {
  DONT_KNOW,
  EVERYONE,
  EVERYTHING,
  NO_ALTERNATIVE,
  NO_COMPETITORS,
  NOBODY_CAN,
  PROBLEM_WORDS,
  SOLUTION_OPENINGS,
  VAGUE,
} from './lexicon';
import type { FindingCode } from './messages';
import { readNumber } from './numbers';
import { getQuestion } from './questions';
import { containsPhrase, fold, sentenceCount, wordCount } from './text';
import type { FollowUpId, NumberRange, Question, QuestionId, Text } from './types';
import { type Answers, totalIn, type ValueByKind, valueOf } from './values';

/**
 * - reject: not accepted as written; the founder revises it or answers «لا أعرف».
 * - block: saved, but the calculations cannot go on until it changes (F3 ≥ F1).
 * - warn: saved, with a note that stays visible until resolved.
 * - ask: a clarification is needed before a value can be saved (currency, R4).
 */
export type Severity = 'reject' | 'block' | 'warn' | 'ask';

export interface Finding {
  code: FindingCode;
  severity: Severity;
  questionId: QuestionId | FollowUpId;
  /** Other answers involved, shown side by side (R6). */
  related?: readonly QuestionId[];
  /** The founder's own word, for `{word}`: a currency word, or a number with two readings. */
  word?: string;
  /** Parts still missing (C2), as keys of PROFILE_PARTS. */
  missing?: readonly ProfilePart[];
  /** Ranges to offer (R3). */
  ranges?: readonly NumberRange[];
}

/** Short answers are where a rule phrase is the whole answer, not part of an explanation. */
const SHORT = 8;

function isShortMatch(text: string, phrases: readonly string[]): boolean {
  return wordCount(text) <= SHORT && containsPhrase(text, phrases);
}

function opensWith(text: string, phrases: readonly string[], words = 6): boolean {
  const opening = fold(text).split(' ').slice(0, words).join(' ');
  return containsPhrase(opening, phrases);
}

const hasDigit = (text: string) => /[0-9٠-٩۰-۹]/.test(text);

// ---------------------------------------------------------------------------------------------
// C2: the first customer
// ---------------------------------------------------------------------------------------------

export type ProfilePart = keyof ValueByKind['customer_profile'];

export const PROFILE_PARTS: Readonly<Record<ProfilePart, Text>> = {
  ageBand: { ar: 'الفئة العمرية', en: 'age band' },
  city: { ar: 'المدينة', en: 'city' },
  incomeBand: { ar: 'مستوى الدخل', en: 'income level' },
  occupation: { ar: 'المهنة', en: 'occupation' },
  sector: { ar: 'القطاع', en: 'sector' },
  size: { ar: 'حجم المنشأة', en: 'size' },
  decisionMaker: { ar: 'مسمّى صاحب القرار', en: 'decision-maker’s title' },
};

const INDIVIDUAL: readonly ProfilePart[] = ['ageBand', 'city', 'incomeBand', 'occupation'];
const ORGANISATION: readonly ProfilePart[] = ['sector', 'size', 'decisionMaker'];

/**
 * The parts of the customer profile (C2) that fit the payer in C1: a person's for b2c, an
 * organisation's for b2b and b2g, both kinds for a mix or while C1 has no answer. The editor shows
 * these and missingProfileParts asks for them, so the two cannot disagree (ARCH-7).
 */
export function profilePartsFor(payer: string | undefined): {
  individual: readonly ProfilePart[];
  organisation: readonly ProfilePart[];
} {
  return {
    individual: payer === 'b2b' || payer === 'b2g' ? [] : INDIVIDUAL,
    organisation: payer === 'b2c' ? [] : ORGANISATION,
  };
}

/** The parts still missing for the kind of payer in C1; a mix needs one complete kind. */
export function missingProfileParts(
  profile: ValueByKind['customer_profile'],
  payer: string | undefined,
): ProfilePart[] {
  // Nothing is asked for until C1 says who pays.
  if (payer === undefined) return [];
  const kinds = Object.values(profilePartsFor(payer))
    .filter((parts) => parts.length > 0)
    .map((parts) => ({ parts, missing: parts.filter((part) => (profile[part] ?? '') === '') }));
  if (kinds.some((kind) => kind.missing.length === 0)) return [];
  // A mix: ask for the kind closer to complete, the person's on a tie.
  const share = (kind: (typeof kinds)[number]) => kind.missing.length / kind.parts.length;
  const [closest] = kinds.sort((a, b) => share(a) - share(b));
  return closest?.missing ?? [];
}

// ---------------------------------------------------------------------------------------------
// One answer
// ---------------------------------------------------------------------------------------------

/** A rule a question can list for its free text (R3, R4 and R6 apply wherever they can). */
export type TextRule = Question['rules'][number];

const RULE_CODES: Readonly<Record<TextRule, FindingCode>> = {
  R1: 'R1_everyone',
  R2: 'R2_no_competitors',
  R5: 'R5_vague',
  R7: 'R7_too_short',
  R8: 'R8_solution',
};

/** B4 asks how people cope today: there R2 is about that alternative, not about competitors. */
const R2_ALTERNATIVE: QuestionId = 'B4';

/**
 * The rejection a text rule gives on a question: the same message whichever check found it, the
 * fixed phrases here or the AI review (SPEC §2, ARCH-7).
 */
export function ruleFinding(questionId: QuestionId, rule: TextRule): Finding {
  const code =
    rule === 'R2' && questionId === R2_ALTERNATIVE ? 'R2_no_alternative' : RULE_CODES[rule];
  return { code, severity: 'reject', questionId };
}

/** The free text inside an answer, where the text rules look. */
function textsOf(question: Question, value: unknown): string[] {
  switch (question.field.kind) {
    case 'short_text':
    case 'long_text':
      return [value as string];
    case 'multi':
      return [(value as ValueByKind['multi']).other ?? ''];
    case 'customer_profile': {
      const profile = value as ValueByKind['customer_profile'];
      return [profile.city ?? '', profile.occupation ?? '', profile.decisionMaker ?? ''];
    }
    case 'competitors':
      return (value as ValueByKind['competitors']).items.map((item) => item.name);
    default:
      return [];
  }
}

function textRules(question: Question, texts: readonly string[]): Finding[] {
  const findings: Finding[] = [];
  const id = question.id;
  const reject = (rule: TextRule) => {
    findings.push(ruleFinding(id, rule));
  };
  const nonEmpty = texts.filter((text) => text.trim() !== '');

  if (question.allowUnknown && nonEmpty.some((text) => isShortMatch(text, DONT_KNOW))) {
    findings.push({ code: 'R4_unknown_text', severity: 'ask', questionId: id });
    return findings;
  }
  if (question.rules.includes('R1') && nonEmpty.some((text) => isShortMatch(text, EVERYONE))) {
    reject('R1');
  }
  if (question.rules.includes('R2')) {
    const phrases = id === R2_ALTERNATIVE ? NO_ALTERNATIVE : NO_COMPETITORS;
    if (nonEmpty.some((text) => isShortMatch(text, phrases))) reject('R2');
  }
  if (
    question.rules.includes('R5') &&
    nonEmpty.some((text) => containsPhrase(text, VAGUE) && !hasDigit(text))
  ) {
    reject('R5');
  }
  if (question.rules.includes('R7') && question.field.kind === 'long_text') {
    const { minWords } = question.field;
    if (nonEmpty.some((text) => wordCount(text) < minWords)) reject('R7');
  }
  if (
    question.rules.includes('R8') &&
    nonEmpty.some(
      (text) => opensWith(text, SOLUTION_OPENINGS) && !containsPhrase(text, PROBLEM_WORDS),
    )
  ) {
    reject('R8');
  }
  return findings;
}

/** Checks specific to one question (the Logic column of SPEC §1). */
function questionRules(question: Question, value: unknown, answers: Answers): Finding[] {
  const id = question.id;
  const finding = (
    code: FindingCode,
    severity: Severity,
    extra: Partial<Finding> = {},
  ): Finding => ({
    code,
    severity,
    questionId: id,
    ...extra,
  });

  switch (id) {
    case 'A3': {
      const { other } = value as ValueByKind['multi'];
      return other !== undefined && isShortMatch(other, EVERYTHING)
        ? [finding('A3_everything', 'reject')]
        : [];
    }
    case 'A6':
      return (value as number) < 10 ? [finding('A6_low_hours', 'warn')] : [];
    case 'B1': {
      const text = value as string;
      const findings: Finding[] = [];
      if (
        question.field.kind === 'short_text' &&
        wordCount(text) > (question.field.maxWords ?? Infinity)
      ) {
        findings.push(finding('B1_too_long', 'reject'));
      }
      if (sentenceCount(text) > 1) findings.push(finding('B1_one_sentence', 'reject'));
      return findings;
    }
    case 'B5':
      return value === 0 ? [finding('B5_untested', 'warn')] : [];
    case 'B8':
      return isShortMatch(value as string, NOBODY_CAN) ? [finding('B8_nobody', 'reject')] : [];
    case 'C2': {
      const missing = missingProfileParts(
        value as ValueByKind['customer_profile'],
        valueOf(answers, 'C1', 'single'),
      );
      return missing.length > 0 ? [finding('C2_incomplete', 'reject', { missing })] : [];
    }
    case 'D1':
      return value === 'multi_country' ? [finding('D1_focus', 'warn')] : [];
    case 'E4':
      return (value as ValueByKind['people']).items.length === 1
        ? [finding('E4_single_supplier', 'warn')]
        : [];
    case 'F4':
      return (value as ValueByKind['cost_items']).items.every((item) => item.amount === 0)
        ? [finding('F4_zero', 'reject')]
        : [];
    case 'G6':
      return value === false ? [finding('G6_later_path', 'warn')] : [];
    case 'H1': {
      const text = value as string;
      // R5 already covers vague words; a goal with no number at all is not measurable.
      return !hasDigit(text) && !containsPhrase(text, VAGUE)
        ? [finding('H1_not_measurable', 'reject')]
        : [];
    }
    default:
      return [];
  }
}

/**
 * Checks one core answer against its rules. `answers` gives the context some rules need (C2 reads
 * C1). «لا أعرف» is never rejected: it becomes an assumption with a validation task (D-104).
 */
export function reviewAnswer(id: QuestionId, answer: Answer, answers: Answers = {}): Finding[] {
  if (answer.status === 'unknown') return [];
  const question = getQuestion(id);
  const fromText = textRules(question, textsOf(question, answer.value));
  if (fromText.some((finding) => finding.code === 'R4_unknown_text')) return fromText;
  const findings = [...fromText, ...questionRules(question, answer.value, answers)];
  // One reason at a time: a specific rejection says more than "too short".
  const specific = findings.some(
    (finding) => finding.severity === 'reject' && finding.code !== 'R7_too_short',
  );
  return specific ? findings.filter((finding) => finding.code !== 'R7_too_short') : findings;
}

const R3_CODES = {
  not_a_number: 'R3_not_numeric',
  range: 'R3_range',
  ambiguous: 'R3_ambiguous',
} as const satisfies Record<string, FindingCode>;

/**
 * R3: what a number field says when the typed text is not one number it can read. A number
 * with two readings ("1.500") asks which one is meant, with the founder's own `word`; any other
 * case offers the question's ranges.
 */
export function reviewNumberText(id: QuestionId, text: string): Finding[] {
  const question = getQuestion(id);
  if (question.field.kind !== 'number') return [];
  const reading = readNumber(text);
  if (reading.ok || reading.reason === 'empty') return [];
  if (reading.reason === 'two_readings') {
    return [{ code: 'R3_two_readings', severity: 'ask', questionId: id, word: reading.typed }];
  }
  return [
    {
      code: R3_CODES[reading.reason],
      severity: 'ask',
      questionId: id,
      ranges: question.field.ranges,
    },
  ];
}

/**
 * Currency questions for an amount typed as text (CLAUDE.md §3, D-108). `currency` is the one
 * already chosen for the field; the text never replaces it.
 */
export function reviewAmountText(
  id: QuestionId | FollowUpId,
  text: string,
  currency?: string,
): Finding[] {
  const reading = readCurrency(text, currency);
  const findings: Finding[] = [];
  if (reading.maybeCentimes) {
    findings.push({ code: 'currency_centimes', severity: 'ask', questionId: id });
  }
  if (currency === undefined) {
    for (const word of reading.ambiguous) {
      findings.push({ code: 'currency_ambiguous', severity: 'ask', questionId: id, word });
    }
  }
  return findings;
}

// ---------------------------------------------------------------------------------------------
// Across answers (R6 and the cross-question checks of SPEC §1)
// ---------------------------------------------------------------------------------------------

const RUNWAY_MONTHS: Readonly<Record<string, number>> = {
  lt3: 3,
  '3to6': 6,
  '6to12': 12,
  gt12: Infinity,
};
const BREAKEVEN_MONTHS: Readonly<Record<string, number>> = {
  m6: 6,
  m12: 12,
  m18: 18,
  m24: 24,
  m36: 36,
  more: 37,
};

/** Findings that involve more than one answer. They stay listed until the answers agree. */
export function reviewProject(answers: Answers): Finding[] {
  const findings: Finding[] = [];

  const price = valueOf(answers, 'F1', 'money');
  const variable = valueOf(answers, 'F3', 'cost_items');
  if (price && variable) {
    const total = totalIn(variable.items, price.currency);
    if (total !== null && total >= price.amount) {
      findings.push({
        code: 'F3_exceeds_price',
        severity: 'block',
        questionId: 'F3',
        related: ['F1'],
      });
    }
  }

  const capital = valueOf(answers, 'A5', 'money_range');
  const setup = valueOf(answers, 'F5', 'cost_items');
  if (capital && setup) {
    const total = totalIn(setup.items, capital.currency);
    if (total !== null && total > capital.max) {
      findings.push({
        code: 'F5_exceeds_capital',
        severity: 'warn',
        questionId: 'F5',
        related: ['A5', 'H3'],
      });
    }
  }

  const interviews = valueOf(answers, 'B5', 'number');
  const paid = valueOf(answers, 'C6', 'single');
  if (interviews === 0 && (paid === 'paid' || paid === 'promised')) {
    findings.push({
      code: 'R6_interviews_vs_payment',
      severity: 'warn',
      questionId: 'C6',
      related: ['B5'],
    });
  }

  const sales = valueOf(answers, 'F6', 'sales_forecast');
  const capacity = valueOf(answers, 'E7', 'number');
  if (sales && capacity !== undefined && sales.month1 > capacity) {
    findings.push({
      code: 'R6_sales_vs_capacity',
      severity: 'warn',
      questionId: 'F6',
      related: ['E7'],
    });
  }

  const team = valueOf(answers, 'A4', 'people');
  const ownership = valueOf(answers, 'G4', 'percent_split');
  if (team?.items.length === 0 && ownership && ownership.items.length >= 2) {
    findings.push({
      code: 'R6_team_vs_ownership',
      severity: 'warn',
      questionId: 'G4',
      related: ['A4'],
    });
  }

  const runway = valueOf(answers, 'A7', 'single');
  const breakeven = valueOf(answers, 'H5', 'single');
  if (
    runway &&
    breakeven &&
    (BREAKEVEN_MONTHS[breakeven] ?? 0) > (RUNWAY_MONTHS[runway] ?? Infinity)
  ) {
    findings.push({
      code: 'R6_breakeven_vs_runway',
      severity: 'warn',
      questionId: 'H5',
      related: ['A7'],
    });
  }

  const agreement = answers['G4.1'];
  if (agreement?.status === 'answered' && agreement.value === false) {
    findings.push({
      code: 'G4_no_agreement',
      severity: 'warn',
      questionId: 'G4.1',
      related: ['G4'],
    });
  }

  return findings;
}
