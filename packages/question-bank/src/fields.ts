import { z } from 'zod';
import { isCurrencyCode } from './currency';
import { AGE_BANDS, COMPANY_SIZES, INCOME_BANDS, SECTORS } from './options';
import type { Field, Option } from './types';

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

/** Tolerance for percentages that must add up to 100 (G4). */
const PERCENT_TOLERANCE = 0.01;

/**
 * The exact shape of a real answer for a field. «لا أعرف» is not a value: it is stored as an
 * unknown answer instead (see `answerSchema`).
 */
export function valueSchema(field: Field): z.ZodType {
  switch (field.kind) {
    case 'short_text':
      return text(600);
    case 'long_text':
      return text(4000);
    case 'number': {
      const base = z.number().min(field.min).max(field.max);
      return field.integer ? base.int() : base;
    }
    case 'boolean':
      return z.boolean();
    case 'single':
      return optionValue(field.options);
    case 'multi':
      return z
        .object({
          values: z.array(optionValue(field.options)).max(field.options.length),
          other: field.other ? optionalText(200) : z.undefined().optional(),
        })
        .strict()
        .refine((value) => value.values.length > 0 || (value.other ?? '') !== '', 'choose_option')
        .refine((value) => new Set(value.values).size === value.values.length, 'duplicate');
    case 'money':
      return money;
    case 'money_range':
      return z
        .object({ min: amount, max: amount, currency: currencyCode })
        .strict()
        .refine((value) => value.min <= value.max, 'min_above_max');
    case 'currency':
      return currencyCode;
    case 'country_city':
      return z.object({ country: z.string().regex(/^[A-Z]{2}$/), city: text(80) }).strict();
    case 'cost_items':
      return z
        .object({
          items: z
            .array(z.object({ label: text(80), amount, currency: currencyCode }).strict())
            .min(field.minItems)
            .max(50),
        })
        .strict();
    case 'people':
      return z
        .object({
          items: z
            .array(z.object({ name: text(80), detail: optionalText(200) }).strict())
            .min(field.minItems)
            .max(30),
        })
        .strict();
    case 'competitors':
      return z
        .object({
          items: z
            .array(
              z
                .object({
                  name: text(80),
                  // http or https to a domain name only: never javascript:, data:, file: or an
                  // IP address, since reports will render these answers (M5).
                  url: z.httpUrl().max(300).optional(),
                  strength: text(200),
                  weakness: text(200),
                })
                .strict(),
            )
            .min(field.minItems)
            .max(15),
        })
        .strict();
    case 'competitor_prices':
      return z
        .object({
          items: z
            .array(z.object({ name: text(80), price: money.nullable() }).strict())
            .min(1)
            .max(15),
        })
        .strict();
    case 'percent_split':
      return z
        .object({
          items: z
            .array(z.object({ label: text(80), percent: z.number().gt(0).max(100) }).strict())
            .min(1)
            .max(20),
        })
        .strict()
        .refine(
          (value) =>
            Math.abs(value.items.reduce((sum, item) => sum + item.percent, 0) - 100) <=
            PERCENT_TOLERANCE,
          'percent_total',
        );
    case 'yes_no_detail':
      return z
        .object({ answer: z.boolean(), detail: optionalText(400) })
        .strict()
        .refine(
          (value) => value.answer !== (field.detailWhen === 'yes') || (value.detail ?? '') !== '',
          'detail_required',
        );
    case 'yes_no_percent':
      return z
        .object({ answer: z.boolean(), percent: z.number().min(0).max(100).optional() })
        .strict()
        .refine((value) => !value.answer || value.percent !== undefined, 'percent_required');
    case 'seasonality':
      return z
        .object({
          seasonal: z.boolean(),
          peakMonths: z.array(z.number().int().min(1).max(12)).max(12),
        })
        .strict()
        .refine((value) => !value.seasonal || value.peakMonths.length > 0, 'peak_months')
        .refine((value) => new Set(value.peakMonths).size === value.peakMonths.length, 'duplicate');
    case 'sales_forecast': {
      const units = z.number().nonnegative().max(MAX_AMOUNT);
      return z.object({ month1: units, month6: units, month12: units }).strict();
    }
    case 'three_texts':
      return z.object({ items: z.tuple([text(120), text(120), text(120)]) }).strict();
    case 'staff_plan':
      return z
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
            .max(50),
        })
        .strict();
    case 'customer_profile':
      // Which parts are required depends on C1 (who pays); checked in review.ts.
      return z
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
        );
  }
}

/** A stored answer: a real value, or «لا أعرف» (D-104). */
export type Answer = { status: 'answered'; value: unknown } | { status: 'unknown' };

export function answerSchema(field: Field, allowUnknown: boolean): z.ZodType<Answer> {
  const answered = z.object({ status: z.literal('answered'), value: valueSchema(field) }).strict();
  const unknown = z.object({ status: z.literal('unknown') }).strict();
  return (allowUnknown ? z.union([answered, unknown]) : answered) as z.ZodType<Answer>;
}
