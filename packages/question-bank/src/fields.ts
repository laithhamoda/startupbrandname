import { z } from 'zod';
import { isCurrencyCode } from './currency';
import { AGE_BANDS, COMPANY_SIZES, INCOME_BANDS, SECTORS } from './options';
import type { Field, FieldKind, FieldOf, Option } from './types';
import type { ValueByKind } from './values';

const MAX_AMOUNT = 1_000_000_000_000;

/**
 * Codes of the checks below, used as zod issue messages so the app can show them in the page
 * language. zod's own codes (too_small, invalid_type…) cover the rest.
 */
export const VALUE_ISSUES = [
  'currency',
  'choose_option',
  'duplicate',
  'min_above_max',
  'percent_total',
  'detail_required',
  'percent_required',
  'peak_months',
  'describe_customer',
] as const;
export type ValueIssue = (typeof VALUE_ISSUES)[number];

const text = (max: number) => z.string().trim().min(1).max(max);
const optionalText = (max: number) => z.string().trim().max(max).optional();
const currencyCode = z.string().refine(isCurrencyCode, 'currency');
const amount = z.number().nonnegative().max(MAX_AMOUNT);
const money = z.object({ amount, currency: currencyCode }).strict();
const optionValue = (options: readonly Option[]) =>
  z.enum(options.map((item) => item.value) as [string, ...string[]]);

/**
 * A website's host: a domain name whose top-level domain is letters, or an Arabic one, which the
 * URL parser has already turned into punycode (.الأردن is xn--mgbayh7gpa). zod's own domain
 * check (z.httpUrl) refuses those. IP addresses and single names such as localhost still fail.
 */
const WEBSITE_HOST =
  /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:[a-z]{2,63}|xn--[a-z0-9-]{1,59})$/i;
/** http or https to a domain name only: never javascript:, data:, file: or an IP address. */
const website = z.url({ protocol: z.regexes.httpProtocol, hostname: WEBSITE_HOST }).max(300);

/** Tolerance for percentages that must add up to 100 (G4). */
const PERCENT_TOLERANCE = 0.01;

/** The most rows each list answer may hold. */
const MAX_ITEMS = {
  cost_items: 50,
  people: 30,
  competitors: 15,
  competitor_prices: 15,
  percent_split: 20,
  staff_plan: 50,
} as const satisfies Partial<Record<FieldKind, number>>;

/**
 * The most rows a list answer may hold, or null for a field that is not a list. The schema below
 * and the editor's "Add" both read it, so the editor never offers a row the server refuses
 * (ARCH-M2).
 */
export function maxItemsFor(field: Field): number | null {
  return (MAX_ITEMS as Partial<Record<FieldKind, number>>)[field.kind] ?? null;
}

/**
 * The schema of each kind's value, typed against ValueByKind (values.ts): a schema whose values
 * lack a part declared there, or give it another type, fails the typecheck (ARCH-4). Each one
 * receives only its own kind of field. The stored shape itself is pinned by contract.test.ts.
 */
const VALUE_SCHEMAS: { [K in FieldKind]: (field: FieldOf<K>) => z.ZodType<ValueByKind[K]> } = {
  short_text: () => text(600),
  long_text: () => text(4000),
  number: (field) => {
    const base = z.number().min(field.min).max(field.max);
    return field.integer ? base.int() : base;
  },
  boolean: () => z.boolean(),
  single: (field) => optionValue(field.options),
  multi: (field) =>
    z
      .object({
        values: z.array(optionValue(field.options)).max(field.options.length),
        other: field.other ? optionalText(200) : z.undefined().optional(),
      })
      .strict()
      .refine((value) => value.values.length > 0 || (value.other ?? '') !== '', 'choose_option')
      .refine((value) => new Set(value.values).size === value.values.length, 'duplicate'),
  money: () => money,
  money_range: () =>
    z
      .object({ min: amount, max: amount, currency: currencyCode })
      .strict()
      .refine((value) => value.min <= value.max, 'min_above_max'),
  currency: () => currencyCode,
  country_city: () =>
    z.object({ country: z.string().regex(/^[A-Z]{2}$/), city: text(80) }).strict(),
  cost_items: (field) =>
    z
      .object({
        items: z
          .array(z.object({ label: text(80), amount, currency: currencyCode }).strict())
          .min(field.minItems)
          .max(MAX_ITEMS.cost_items),
      })
      .strict(),
  people: (field) =>
    z
      .object({
        items: z
          .array(z.object({ name: text(80), detail: optionalText(200) }).strict())
          .min(field.minItems)
          .max(MAX_ITEMS.people),
      })
      .strict(),
  competitors: (field) =>
    z
      .object({
        items: z
          .array(
            z
              .object({
                name: text(80),
                // Reports will render these answers as links (M5).
                url: website.optional(),
                strength: text(200),
                weakness: text(200),
              })
              .strict(),
          )
          .min(field.minItems)
          .max(MAX_ITEMS.competitors),
      })
      .strict(),
  competitor_prices: () =>
    z
      .object({
        items: z
          .array(z.object({ name: text(80), price: money.nullable() }).strict())
          .min(1)
          .max(MAX_ITEMS.competitor_prices),
      })
      .strict(),
  percent_split: () =>
    z
      .object({
        items: z
          .array(z.object({ label: text(80), percent: z.number().gt(0).max(100) }).strict())
          .min(1)
          .max(MAX_ITEMS.percent_split),
      })
      .strict()
      .refine(
        (value) =>
          Math.abs(value.items.reduce((sum, item) => sum + item.percent, 0) - 100) <=
          PERCENT_TOLERANCE,
        'percent_total',
      ),
  yes_no_detail: (field) =>
    z
      .object({ answer: z.boolean(), detail: optionalText(400) })
      .strict()
      .refine(
        (value) => value.answer !== (field.detailWhen === 'yes') || (value.detail ?? '') !== '',
        'detail_required',
      ),
  yes_no_percent: () =>
    z
      .object({ answer: z.boolean(), percent: z.number().min(0).max(100).optional() })
      .strict()
      .refine((value) => !value.answer || value.percent !== undefined, 'percent_required'),
  seasonality: () =>
    z
      .object({
        seasonal: z.boolean(),
        peakMonths: z.array(z.number().int().min(1).max(12)).max(12),
      })
      .strict()
      .refine((value) => !value.seasonal || value.peakMonths.length > 0, 'peak_months')
      .refine((value) => new Set(value.peakMonths).size === value.peakMonths.length, 'duplicate'),
  sales_forecast: () => {
    const units = z.number().nonnegative().max(MAX_AMOUNT);
    return z.object({ month1: units, month6: units, month12: units }).strict();
  },
  three_texts: () => z.object({ items: z.tuple([text(120), text(120), text(120)]) }).strict(),
  staff_plan: () =>
    z
      .object({
        items: z
          .array(
            z
              .object({
                role: text(80),
                monthlyCost: money,
                startMonth: z.number().int().min(1).max(36),
              })
              .strict(),
          )
          .max(MAX_ITEMS.staff_plan),
      })
      .strict(),
  // Which parts are required depends on C1 (who pays); checked in review.ts.
  customer_profile: () =>
    z
      .object({
        ageBand: optionValue(AGE_BANDS).optional(),
        city: optionalText(80),
        incomeBand: optionValue(INCOME_BANDS).optional(),
        occupation: optionalText(120),
        sector: optionValue(SECTORS).optional(),
        size: optionValue(COMPANY_SIZES).optional(),
        decisionMaker: optionalText(120),
      })
      .strict()
      .refine(
        (value) =>
          Object.values(value).some((part) => typeof part === 'string' && part.trim() !== ''),
        'describe_customer',
      ),
};

/**
 * The exact shape of a real answer for a field. «لا أعرف» is not a value: it is stored as an
 * unknown answer instead (see `answerSchema`). The kind is the type parameter, read from the
 * field, so the entry picked is the one typed for that kind and needs no cast: a plain `Field`
 * gives a schema of any value, a field of one kind the schema of that kind's value.
 */
export function valueSchema<K extends FieldKind>(
  field: FieldOf<K> & { kind: K },
): z.ZodType<ValueByKind[K]> {
  return VALUE_SCHEMAS[field.kind](field);
}

/** A schema without the optional or nullable wrapper around it. */
function unwrapped(schema: unknown): unknown {
  return schema instanceof z.ZodOptional || schema instanceof z.ZodNullable
    ? unwrapped(schema.unwrap())
    : schema;
}

/**
 * The bounds of the number at `path` in a field's value ("items.1.amount", or '' for a number
 * answer), read from the schema above, so a message can state them (UX-3). Null where the path
 * holds no number.
 */
export function numberLimits(field: Field, path: string): { min: number; max: number } | null {
  let schema = unwrapped(valueSchema(field));
  for (const key of path === '' ? [] : path.split('.')) {
    if (schema instanceof z.ZodObject) schema = unwrapped(schema.shape[key]);
    else if (schema instanceof z.ZodArray && /^\d+$/.test(key)) schema = unwrapped(schema.element);
    else return null;
  }
  return schema instanceof z.ZodNumber && schema.minValue !== null && schema.maxValue !== null
    ? { min: schema.minValue, max: schema.maxValue }
    : null;
}

/** A stored answer: a real value, or «لا أعرف» (D-104). */
export type Answer = { status: 'answered'; value: unknown } | { status: 'unknown' };

export function answerSchema(field: Field, allowUnknown: boolean): z.ZodType<Answer> {
  const answered = z.object({ status: z.literal('answered'), value: valueSchema(field) }).strict();
  const unknown = z.object({ status: z.literal('unknown') }).strict();
  return (allowUnknown ? z.union([answered, unknown]) : answered) as z.ZodType<Answer>;
}
