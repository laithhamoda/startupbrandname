import {
  AGE_BANDS,
  COMPANY_SIZES,
  findFollowUp,
  getQuestion,
  INCOME_BANDS,
  isQuestionId,
  type Field,
  type Language,
  type Option,
  SECTORS,
  type StepId,
  type ValueByKind,
} from '@sbn/question-bank';
import type { CanvasChip, ChipProvenance } from './types';

/** What a chip needs besides the value: the page language and how it writes a currency. */
export interface ChipContext {
  readonly language: Language;
  readonly currencyLabel: (code: string) => string;
}

/** The field a step asks for: a core question's, or a follow-up's. */
export function fieldOfStep(id: StepId): Field {
  if (isQuestionId(id)) return getQuestion(id).field;
  const followUp = findFollowUp(id);
  if (!followUp) throw new Error(`${id} is no step`);
  return followUp.field;
}

/**
 * A number as the founder typed it: plain digits, no grouping, no trailing zeros after the point.
 * The page isolates it with `<bdi>`; the currency goes after it (CLAUDE.md §6).
 */
export function plainNumber(value: number | string): string {
  const text = typeof value === 'number' ? String(value) : value;
  if (!text.includes('.')) return text;
  // Walk back over the zeros and then over a bare point, instead of a pattern that backtracks on a
  // long run of zeros.
  let end = text.length;
  while (end > 0 && text.charCodeAt(end - 1) === 48) end -= 1;
  if (end > 0 && text.charCodeAt(end - 1) === 46) end -= 1;
  return text.slice(0, end);
}

/** An amount with the currency after it, as the diagnostic's money box and the totals write it. */
export function amountText(amount: number | string, currency: string, context: ChipContext) {
  return `${plainNumber(amount)} ${context.currencyLabel(currency)}`;
}

function optionText(options: readonly Option[], value: string, language: Language): string {
  return options.find((option) => option.value === value)?.label[language] ?? value;
}

/** Items of a list shown on one line: the comma of the page language. */
function joined(parts: readonly string[], language: Language): string {
  return parts.join(language === 'ar' ? '، ' : ', ');
}

const clean = (text: string | undefined): string => text?.trim() ?? '';

/** The parts of the first customer, in the order that reads naturally for a person or a business. */
function profileText(value: ValueByKind['customer_profile'], language: Language): string {
  const parts = [
    clean(value.occupation),
    value.sector ? optionText(SECTORS, value.sector, language) : '',
    value.size ? optionText(COMPANY_SIZES, value.size, language) : '',
    value.ageBand ? optionText(AGE_BANDS, value.ageBand, language) : '',
    value.incomeBand ? optionText(INCOME_BANDS, value.incomeBand, language) : '',
    clean(value.city),
    clean(value.decisionMaker),
  ].filter((part) => part !== '');
  return parts.join(' · ');
}

interface Line {
  readonly label: string | null;
  readonly text: string;
}

/**
 * The lines an answer gives, as the founder wrote them: one for a plain answer, one for each row
 * of a list answer. A part the founder left empty gives no line, so a chip never shows blank text.
 * Throws for a kind of field the canvas has no reading for, so a new source in the map cannot
 * silently show nothing.
 */
function linesOf(field: Field, value: unknown, context: ChipContext): readonly Line[] {
  const { language } = context;
  const plain = (text: string): readonly Line[] =>
    text.trim() === '' ? [] : [{ label: null, text: text.trim() }];
  switch (field.kind) {
    case 'short_text':
    case 'long_text':
      return plain(value as string);
    case 'single':
      return plain(optionText(field.options, value as string, language));
    case 'multi': {
      const chosen = value as ValueByKind['multi'];
      const labels = chosen.values.map((item) => optionText(field.options, item, language));
      const other = clean(chosen.other);
      return plain(joined(other === '' ? labels : [...labels, other], language));
    }
    case 'customer_profile':
      return plain(profileText(value as ValueByKind['customer_profile'], language));
    case 'money': {
      const money = value as ValueByKind['money'];
      return plain(amountText(money.amount, money.currency, context));
    }
    case 'cost_items':
      return (value as ValueByKind['cost_items']).items.map((item) => ({
        label: clean(item.label) === '' ? null : clean(item.label),
        text: amountText(item.amount, item.currency, context),
      }));
    case 'staff_plan':
      return (value as ValueByKind['staff_plan']).items.map((item) => ({
        label: clean(item.role) === '' ? null : clean(item.role),
        text: amountText(item.monthlyCost.amount, item.monthlyCost.currency, context),
      }));
    case 'people':
      return (value as ValueByKind['people']).items.flatMap((item) => {
        const detail = clean(item.detail);
        const name = clean(item.name);
        if (detail === '') return name === '' ? [] : [{ label: null, text: name }];
        return [{ label: name === '' ? null : name, text: detail }];
      });
    case 'competitors':
      return (value as ValueByKind['competitors']).items.flatMap((item) => plain(item.name));
    case 'three_texts':
      return (value as ValueByKind['three_texts']).items.flatMap((item) => plain(item));
    default:
      throw new Error(`The canvas cannot show a ${field.kind} answer.`);
  }
}

/**
 * The chips of one answered source: one chip, or one for each row of a list source. All of them
 * carry the provenance of the answer they came from (rule 2).
 */
export function chipsOf(
  id: StepId,
  value: unknown,
  list: boolean,
  provenance: ChipProvenance,
  context: ChipContext,
): readonly CanvasChip[] {
  const lines = linesOf(fieldOfStep(id), value, context);
  return lines.map((line, index) => ({
    key: list ? `${id}:${String(index)}` : id,
    questionId: id,
    label: line.label,
    text: line.text,
    provenance,
  }));
}
