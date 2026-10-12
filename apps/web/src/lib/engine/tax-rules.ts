import {
  type CurrencyCode,
  isKnownCurrency,
  makeMoney,
  makeRate,
  moneyFromSafeMinor,
  type Money,
  type Rate,
  type TaxBracket,
  type TaxRule,
  validateTaxRule,
} from '@sbn/engine';
import { z } from 'zod';
import type { Database } from '@/lib/supabase/database.types';

/** A row of `tax_rules` as the database client returns it (D-243). */
export type TaxRuleRow = Database['public']['Tables']['tax_rules']['Row'];

/** A rate is the exact fraction "n/d" of two whole numbers, d above 0 (D-243). */
const FRACTION = /^(\d{1,30})\/([1-9]\d{0,29})$/;

const minorText = z.string().regex(/^\d{1,30}$/);

const legalFormSchema = z.enum(['sole', 'company']);
const kindSchema = z.enum(['tax', 'social_contribution']);
const basisSchema = z.enum(['turnover', 'profit', 'fixed']);

/** `brackets` is a list of {"up_to": minor units as text or null, "rate": "n/d"} (D-243). */
const bracketsSchema = z.array(
  z.object({ up_to: minorText.nullable(), rate: z.string().regex(FRACTION) }).strict(),
);

/** The two integers of "n/d" as an exact rate; no float is ever involved (rule 1). */
export function rateFromFraction(text: string): Rate {
  const match = FRACTION.exec(text);
  if (!match) throw new Error('A rate must be a fraction "n/d" with d above 0.');
  return makeRate(BigInt(match[1] ?? ''), BigInt(match[2] ?? ''));
}

/**
 * Minor units the database holds in a `bigint` column. The client returns them as a JavaScript
 * number, so a value beyond 2^53 has already lost digits: `moneyFromSafeMinor` refuses it.
 */
function money(minor: number | null, currency: CurrencyCode): Money | null {
  return minor === null ? null : moneyFromSafeMinor(minor, currency);
}

/**
 * One `tax_rules` row as the engine's `TaxRule` (D-243): the rate and each bracket's rate from the
 * two integers of their fraction, every amount as `Money` in the rule's currency. Only `verified`
 * stays verified: the three other statuses are `unverified` to the engine, so the figures built
 * on them stay external and low confidence, and the report shows the label of rule 8. Throws for
 * a row the engine would refuse; `toTaxRules` skips such a row instead.
 */
export function toTaxRule(row: TaxRuleRow): TaxRule {
  if (!isKnownCurrency(row.currency))
    throw new Error('The rule is in a currency the engine lacks.');
  const currency = row.currency;
  const brackets: TaxBracket[] = bracketsSchema.parse(row.brackets).map((bracket) => ({
    upTo: bracket.up_to === null ? null : makeMoney(BigInt(bracket.up_to), currency),
    rate: rateFromFraction(bracket.rate),
  }));
  const rule: TaxRule = {
    id: row.id,
    countryCode: row.country_code,
    legalForm: legalFormSchema.parse(row.legal_form),
    regime: row.regime,
    levy: row.levy,
    kind: kindSchema.parse(row.kind),
    basis: basisSchema.parse(row.basis),
    rate: row.rate === null ? null : rateFromFraction(row.rate),
    brackets,
    fixedAmount: money(row.fixed_amount, currency),
    minimum: money(row.min_amount, currency),
    turnoverCeiling: money(row.ceiling, currency),
    paymentMonth: row.payment_month,
    currency,
    effectiveFrom: row.effective_from,
    sourceUrl: row.source_url,
    lastVerified: row.last_verified,
    status: row.status === 'verified' ? 'verified' : 'unverified',
  };
  validateTaxRule(rule);
  return rule;
}

/**
 * The rules of a country that the engine can read, and how many it could not. A row that fails
 * (an unknown currency, an amount a number cannot hold) is left out: a missing rule only makes the
 * engine say that no regime was calculated, while a wrong one would give a wrong tax (rule 9).
 * The table is empty until step 4, so an empty list is the usual case.
 */
export function toTaxRules(rows: readonly TaxRuleRow[]): { rules: TaxRule[]; skipped: number } {
  const rules: TaxRule[] = [];
  let skipped = 0;
  for (const row of rows) {
    try {
      rules.push(toTaxRule(row));
    } catch {
      skipped += 1;
    }
  }
  return { rules, skipped };
}
