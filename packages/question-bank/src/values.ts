import type { Answer } from './fields';
import { getQuestion } from './questions';
import type { FieldKind, FollowUpId, QuestionId } from './types';

export interface Money {
  amount: number;
  currency: string;
}

/** The value of a real answer, per field kind. `fields.ts` validates exactly these shapes. */
export interface ValueByKind {
  short_text: string;
  long_text: string;
  number: number;
  boolean: boolean;
  single: string;
  multi: { values: string[]; other?: string };
  money: Money;
  money_range: { min: number; max: number; currency: string };
  currency: string;
  country_city: { country: string; city: string };
  cost_items: { items: { label: string; amount: number; currency: string }[] };
  people: { items: { name: string; detail?: string }[] };
  competitors: { items: { name: string; url?: string; strength: string; weakness: string }[] };
  competitor_prices: { items: { name: string; price: Money | null }[] };
  percent_split: { items: { label: string; percent: number }[] };
  yes_no_detail: { answer: boolean; detail?: string };
  yes_no_percent: { answer: boolean; percent?: number };
  seasonality: { seasonal: boolean; peakMonths: number[] };
  sales_forecast: { month1: number; month6: number; month12: number };
  three_texts: { items: [string, string, string] };
  staff_plan: { items: { role: string; monthlyCost: Money; startMonth: number }[] };
  customer_profile: {
    ageBand?: string;
    city?: string;
    incomeBand?: string;
    occupation?: string;
    sector?: string;
    size?: string;
    decisionMaker?: string;
  };
}

/** A project's answers, by core question or follow-up ID. Values are validated before storage. */
export type Answers = Partial<Record<QuestionId | FollowUpId, Answer>>;

/** The value of a core question's real answer, typed by its field; undefined if none. */
export function valueOf<K extends FieldKind>(
  answers: Answers,
  id: QuestionId,
  kind: K,
): ValueByKind[K] | undefined {
  const answer = answers[id];
  if (answer?.status !== 'answered') return undefined;
  if (getQuestion(id).field.kind !== kind) {
    throw new Error(`${id} is a ${getQuestion(id).field.kind} field, not ${kind}`);
  }
  return answer.value as ValueByKind[K];
}

/** Total of a list of amounts when they all share one currency; null when they are mixed. */
export function totalIn(items: readonly { amount: number; currency: string }[], currency: string) {
  if (items.some((item) => item.currency !== currency)) return null;
  return items.reduce((sum, item) => sum + item.amount, 0);
}
