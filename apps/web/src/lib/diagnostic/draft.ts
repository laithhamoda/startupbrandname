import {
  type Field,
  type FieldKind,
  readCurrency,
  readNumber,
  type ValueByKind,
} from '@sbn/question-bank';

/**
 * What a founder is typing, before it becomes an answer. Numbers stay text until submitted so
 * Arabic-Indic digits, separators and words like «ألف» are read by the question bank
 * (`readNumber`), never by the browser. Empty choices are '' or null.
 */
export interface DraftByKind {
  short_text: string;
  long_text: string;
  number: string;
  boolean: boolean | null;
  single: string;
  multi: { values: string[]; other: string };
  money: MoneyDraft;
  money_range: { min: string; max: string; currency: string };
  currency: string;
  country_city: { country: string; city: string };
  cost_items: { items: { label: string; amount: string; currency: string }[] };
  people: { items: { name: string; detail: string }[] };
  competitors: { items: { name: string; url: string; strength: string; weakness: string }[] };
  competitor_prices: {
    items: { name: string; amount: string; currency: string; unknown: boolean }[];
  };
  percent_split: { items: { label: string; percent: string }[] };
  yes_no_detail: { answer: boolean | null; detail: string };
  yes_no_percent: { answer: boolean | null; percent: string };
  seasonality: { seasonal: boolean | null; peakMonths: number[] };
  sales_forecast: { month1: string; month6: string; month12: string };
  three_texts: { items: [string, string, string] };
  staff_plan: { items: { role: string; amount: string; currency: string; startMonth: string }[] };
  customer_profile: {
    ageBand: string;
    city: string;
    incomeBand: string;
    occupation: string;
    sector: string;
    size: string;
    decisionMaker: string;
  };
}

export interface MoneyDraft {
  amount: string;
  currency: string;
}

export type Draft = DraftByKind[FieldKind];

/** What a new draft starts from: the project's currency and country, and D3's competitors. */
export interface DraftContext {
  currency: string;
  country: string;
  competitors: readonly string[];
}

const text = (value: number | undefined) => (value === undefined ? '' : String(value));

export function emptyDraft(field: Field, context: DraftContext): Draft {
  const money = (): MoneyDraft => ({ amount: '', currency: context.currency });
  switch (field.kind) {
    case 'short_text':
    case 'long_text':
    case 'number':
    case 'single':
      return '';
    case 'currency':
      // Never preselected, even from the project (D-111).
      return '';
    case 'boolean':
      return null;
    case 'multi':
      return { values: [], other: '' };
    case 'money':
      return money();
    case 'money_range':
      return { min: '', max: '', currency: context.currency };
    case 'country_city':
      return { country: context.country, city: '' };
    case 'cost_items':
      return { items: [{ label: '', ...money() }] };
    case 'people':
      return { items: field.minItems > 0 ? [{ name: '', detail: '' }] : [] };
    case 'competitors':
      return {
        items: Array.from({ length: field.minItems }, () => ({
          name: '',
          url: '',
          strength: '',
          weakness: '',
        })),
      };
    case 'competitor_prices': {
      const names = context.competitors.length > 0 ? context.competitors : [''];
      return { items: names.map((name) => ({ name, ...money(), unknown: false })) };
    }
    case 'percent_split':
      return { items: [{ label: '', percent: '' }] };
    case 'yes_no_detail':
      return { answer: null, detail: '' };
    case 'yes_no_percent':
      return { answer: null, percent: '' };
    case 'seasonality':
      return { seasonal: null, peakMonths: [] };
    case 'sales_forecast':
      return { month1: '', month6: '', month12: '' };
    case 'three_texts':
      return { items: ['', '', ''] };
    case 'staff_plan':
      return { items: [] };
    case 'customer_profile':
      return {
        ageBand: '',
        city: '',
        incomeBand: '',
        occupation: '',
        sector: '',
        size: '',
        decisionMaker: '',
      };
  }
}

/** A draft from a saved value, to edit an answer again. */
export function toDraft(field: Field, stored: unknown, context: DraftContext): Draft {
  if (stored === undefined) return emptyDraft(field, context);
  switch (field.kind) {
    case 'short_text':
    case 'long_text':
    case 'single':
    case 'currency':
      return stored as string;
    case 'number':
      return (stored as number).toString();
    case 'boolean':
      return stored as boolean;
    case 'multi': {
      const value = stored as ValueByKind['multi'];
      return { values: [...value.values], other: value.other ?? '' };
    }
    case 'money': {
      const value = stored as ValueByKind['money'];
      return { amount: String(value.amount), currency: value.currency };
    }
    case 'money_range': {
      const value = stored as ValueByKind['money_range'];
      return { min: String(value.min), max: String(value.max), currency: value.currency };
    }
    case 'country_city':
      return { ...(stored as ValueByKind['country_city']) };
    case 'cost_items':
      return {
        items: (stored as ValueByKind['cost_items']).items.map((item) => ({
          ...item,
          amount: String(item.amount),
        })),
      };
    case 'people':
      return {
        items: (stored as ValueByKind['people']).items.map((item) => ({
          name: item.name,
          detail: item.detail ?? '',
        })),
      };
    case 'competitors':
      return {
        items: (stored as ValueByKind['competitors']).items.map((item) => ({
          ...item,
          url: item.url ?? '',
        })),
      };
    case 'competitor_prices':
      return {
        items: (stored as ValueByKind['competitor_prices']).items.map((item) => ({
          name: item.name,
          amount: item.price ? String(item.price.amount) : '',
          currency: item.price?.currency ?? context.currency,
          unknown: item.price === null,
        })),
      };
    case 'percent_split':
      return {
        items: (stored as ValueByKind['percent_split']).items.map((item) => ({
          label: item.label,
          percent: String(item.percent),
        })),
      };
    case 'yes_no_detail': {
      const value = stored as ValueByKind['yes_no_detail'];
      return { answer: value.answer, detail: value.detail ?? '' };
    }
    case 'yes_no_percent': {
      const value = stored as ValueByKind['yes_no_percent'];
      return { answer: value.answer, percent: text(value.percent) };
    }
    case 'seasonality': {
      const value = stored as ValueByKind['seasonality'];
      return { seasonal: value.seasonal, peakMonths: [...value.peakMonths] };
    }
    case 'sales_forecast': {
      const value = stored as ValueByKind['sales_forecast'];
      return {
        month1: String(value.month1),
        month6: String(value.month6),
        month12: String(value.month12),
      };
    }
    case 'three_texts':
      return { items: [...(stored as ValueByKind['three_texts']).items] };
    case 'staff_plan':
      return {
        items: (stored as ValueByKind['staff_plan']).items.map((item) => ({
          role: item.role,
          amount: String(item.monthlyCost.amount),
          currency: item.monthlyCost.currency,
          startMonth: String(item.startMonth),
        })),
      };
    case 'customer_profile': {
      const value = stored as ValueByKind['customer_profile'];
      return {
        ageBand: value.ageBand ?? '',
        city: value.city ?? '',
        incomeBand: value.incomeBand ?? '',
        occupation: value.occupation ?? '',
        sector: value.sector ?? '',
        size: value.size ?? '',
        decisionMaker: value.decisionMaker ?? '',
      };
    }
  }
}

export type Conversion =
  | { ok: true; value: unknown }
  /** Paths of number boxes that do not hold a readable number, such as "items.1.amount". */
  | { ok: false; unreadable: string[] };

/**
 * The value to submit for a draft. Only numbers are converted; every other rule (required parts,
 * shapes, totals) is checked on the server against the question bank. With `centimes`, Algerian
 * dinar amounts typed in centimes are divided by 100 (D-108).
 */
export function fromDraft(field: Field, draft: Draft, centimes = false): Conversion {
  const unreadable: string[] = [];
  const number = (value: string, path: string): number | undefined => {
    if (value.trim() === '') return undefined;
    const reading = readNumber(value);
    if (!reading.ok) {
      unreadable.push(path);
      return undefined;
    }
    return reading.value;
  };
  const amount = (money: MoneyDraft, path: string) => {
    const value = number(money.amount, path);
    return value !== undefined && centimes && money.currency === 'DZD' ? value / 100 : value;
  };
  const optional = (value: string) => (value.trim() === '' ? undefined : value);

  let value: unknown;
  switch (field.kind) {
    case 'short_text':
    case 'long_text':
    case 'single':
    case 'currency':
      value = draft;
      break;
    case 'number':
      value = number(draft as string, '');
      break;
    case 'boolean':
      value = draft ?? undefined;
      break;
    case 'multi': {
      const multi = draft as DraftByKind['multi'];
      value = {
        values: multi.values,
        ...(field.other && multi.other.trim() !== '' ? { other: multi.other } : {}),
      };
      break;
    }
    case 'money': {
      const money = draft as MoneyDraft;
      value = { amount: amount(money, 'amount'), currency: money.currency };
      break;
    }
    case 'money_range': {
      const range = draft as DraftByKind['money_range'];
      const scale = centimes && range.currency === 'DZD' ? 100 : 1;
      const min = number(range.min, 'min');
      const max = number(range.max, 'max');
      value = {
        min: min === undefined ? undefined : min / scale,
        max: max === undefined ? undefined : max / scale,
        currency: range.currency,
      };
      break;
    }
    case 'country_city':
      value = draft;
      break;
    case 'cost_items':
      value = {
        items: (draft as DraftByKind['cost_items']).items.map((item, index) => ({
          label: item.label,
          amount: amount(item, `items.${String(index)}.amount`),
          currency: item.currency,
        })),
      };
      break;
    case 'people':
      value = {
        items: (draft as DraftByKind['people']).items.map((item) => ({
          name: item.name,
          ...(item.detail.trim() === '' ? {} : { detail: item.detail }),
        })),
      };
      break;
    case 'competitors':
      value = {
        items: (draft as DraftByKind['competitors']).items.map((item) => ({
          name: item.name,
          ...(item.url.trim() === '' ? {} : { url: item.url.trim() }),
          strength: item.strength,
          weakness: item.weakness,
        })),
      };
      break;
    case 'competitor_prices':
      value = {
        items: (draft as DraftByKind['competitor_prices']).items.map((item, index) => ({
          name: item.name,
          price: item.unknown
            ? null
            : { amount: amount(item, `items.${String(index)}.amount`), currency: item.currency },
        })),
      };
      break;
    case 'percent_split':
      value = {
        items: (draft as DraftByKind['percent_split']).items.map((item, index) => ({
          label: item.label,
          percent: number(item.percent, `items.${String(index)}.percent`),
        })),
      };
      break;
    case 'yes_no_detail': {
      const yesNo = draft as DraftByKind['yes_no_detail'];
      value = {
        answer: yesNo.answer ?? undefined,
        ...(optional(yesNo.detail) ? { detail: yesNo.detail } : {}),
      };
      break;
    }
    case 'yes_no_percent': {
      const yesNo = draft as DraftByKind['yes_no_percent'];
      const percent = yesNo.answer ? number(yesNo.percent, 'percent') : undefined;
      value = { answer: yesNo.answer ?? undefined, ...(percent === undefined ? {} : { percent }) };
      break;
    }
    case 'seasonality': {
      const season = draft as DraftByKind['seasonality'];
      value = {
        seasonal: season.seasonal ?? undefined,
        peakMonths: season.seasonal ? season.peakMonths : [],
      };
      break;
    }
    case 'sales_forecast': {
      const sales = draft as DraftByKind['sales_forecast'];
      value = {
        month1: number(sales.month1, 'month1'),
        month6: number(sales.month6, 'month6'),
        month12: number(sales.month12, 'month12'),
      };
      break;
    }
    case 'three_texts':
      value = draft;
      break;
    case 'staff_plan':
      value = {
        items: (draft as DraftByKind['staff_plan']).items.map((item, index) => ({
          role: item.role,
          monthlyCost: {
            amount: amount(item, `items.${String(index)}.amount`),
            currency: item.currency,
          },
          startMonth: number(item.startMonth, `items.${String(index)}.startMonth`),
        })),
      };
      break;
    case 'customer_profile': {
      const profile = draft as DraftByKind['customer_profile'];
      value = Object.fromEntries(Object.entries(profile).filter(([, part]) => part.trim() !== ''));
      break;
    }
  }
  return unreadable.length > 0 ? { ok: false, unreadable } : { ok: true, value };
}

/** The amounts typed in a draft, with their currency, to ask dinars or centimes (D-108). */
export function typedAmounts(field: Field, draft: Draft): MoneyDraft[] {
  switch (field.kind) {
    case 'money':
      return [draft as MoneyDraft];
    case 'money_range': {
      const range = draft as DraftByKind['money_range'];
      return [
        { amount: range.min, currency: range.currency },
        { amount: range.max, currency: range.currency },
      ];
    }
    case 'cost_items':
    case 'competitor_prices':
    case 'staff_plan':
      return (draft as { items: MoneyDraft[] }).items;
    default:
      return [];
  }
}

/** True when an Algerian-dinar amount was typed in a way that may mean centimes. */
export function mayBeCentimes(field: Field, draft: Draft): boolean {
  return typedAmounts(field, draft).some(
    (money) => money.currency === 'DZD' && readCurrency(money.amount, 'DZD').maybeCentimes,
  );
}
