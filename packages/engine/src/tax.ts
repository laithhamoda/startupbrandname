import type { AlertSeverity, AlertValue } from './alerts';
import { at } from './array';
import { referenceMonth } from './calendar';
import type { CurrencyCode } from './currency';
import { EngineError } from './errors';
import {
  combineFigures,
  combineProvenance,
  type Figure,
  type InputRef,
  type Provenance,
} from './figure';
import type { EngineInput, LegalForm } from './input';
import { divRoundHalfAwayFromZero } from './integer';
import { compareMoney, makeMoney, maxMoney, sumMoney, zeroMoney, type Money } from './money';
import type { OperatingProjection } from './projection';
import { addRates, compareRates, makeRate, ZERO_RATE, type Rate } from './rate';

/** The stable IDs of the tax rules of the engine, listed in the inputs of the figures they produce (D-181). */
export const TAX_RULES = {
  due: 'T9.tax_due',
  yearTotal: 'T9.tax_year_total',
} as const;

/** What a levy is charged on: the year's turnover, the year's profit (never below zero), or a fixed amount. */
export type TaxBasis = 'turnover' | 'profit' | 'fixed';

/** A tax proper, or a social contribution (CASNOS in Algeria, social security in Jordan): the same shape (D-186). */
export type TaxKind = 'tax' | 'social_contribution';

/**
 * Whether the rule was checked against its official source. A rule that is a fixture or not yet
 * verified makes every figure computed from it external, low confidence and unvalidated (D-181,
 * D-211); the 90-day staleness of CLAUDE.md rule 8 is the report's to show, from `lastVerified`.
 */
export type TaxRuleStatus = 'verified' | 'unverified';

/**
 * One step of a progressive tax: the part of the base up to `upTo` (cumulative, in the rule's
 * currency) is taxed at `rate`. The last bracket has no upper limit, `upTo` null.
 */
export interface TaxBracket {
  readonly upTo: Money | null;
  readonly rate: Rate;
}

/**
 * A tax or social-contribution rule: the contract of the `tax_rules` table of M5 (D-186, D-211).
 * The engine holds no rate itself (CLAUDE.md rule 8); the caller passes the rules in force, each
 * with its source and the date it was last verified. Amounts are in `currency`, in minor units.
 *
 * - `legalForm` and `countryCode` pick the regime; `regime` names it and `levy` names what is paid
 *   under it (so a newer rule of the same levy replaces an older one).
 * - `rate` (flat), `brackets` (marginal, progressive) and `fixedAmount` are exclusive: a `fixed`
 *   basis has only the amount, the other bases have exactly one of `rate` and `brackets`.
 * - `minimum` is the least the levy can be for a year; `turnoverCeiling` is the turnover above
 *   which the regime no longer applies (SPEC T9).
 * - `paymentMonth` (1 to 12) is the month of the projection year after the one the tax accrues in.
 */
export interface TaxRule {
  readonly id: string;
  readonly countryCode: string;
  readonly legalForm: LegalForm;
  readonly regime: string;
  readonly levy: string;
  readonly kind: TaxKind;
  readonly basis: TaxBasis;
  readonly rate: Rate | null;
  readonly brackets: readonly TaxBracket[];
  readonly fixedAmount: Money | null;
  readonly minimum: Money | null;
  readonly turnoverCeiling: Money | null;
  readonly paymentMonth: number;
  readonly currency: CurrencyCode;
  /** YYYY-MM-DD: the rule applies to a run made on or after this date. */
  readonly effectiveFrom: string;
  readonly sourceUrl: string;
  /** YYYY-MM-DD of the last check against the source; null when it was never verified. */
  readonly lastVerified: string | null;
  readonly status: TaxRuleStatus;
}

/**
 * What the caller knows about taxes for the project's country: the rules in force, and, when it
 * has one, the turnover above which a business must register for VAT (a figure with its
 * provenance, normally `external`). VAT itself is not calculated (D-186).
 */
export interface TaxContext {
  readonly rules: readonly TaxRule[];
  readonly vatThreshold?: Figure<Money> | null;
}

/** The alerts of the tax engine (SPEC T9, D-186, D-211). */
export type TaxAlertCode =
  'turnover_above_regime_ceiling' | 'turnover_above_vat_threshold' | 'tax_regime_not_calculated';

/** The severity of each tax alert (D-211). */
export const TAX_ALERT_SEVERITY: Readonly<Record<TaxAlertCode, AlertSeverity>> = {
  turnover_above_regime_ceiling: 'warning',
  turnover_above_vat_threshold: 'warning',
  tax_regime_not_calculated: 'warning',
};

/**
 * Why a regime was not calculated (D-186, D-211): `no_rule` (no rule for the country and legal
 * form), `ambiguous_regime` (rules of several regimes: the engine does not pick one), or
 * `rule_other_currency` (the rules are in another currency than the project's: nothing is
 * converted, D-180).
 */
export type TaxGap =
  | { readonly code: 'no_rule' }
  | { readonly code: 'ambiguous_regime'; readonly regimes: readonly string[] }
  | { readonly code: 'rule_other_currency'; readonly currency: string };

/**
 * A raised tax alert: a code, a severity, the projection year it is about (null when it is about
 * the whole regime), what was measured against what, and the provenance of the inputs (D-181).
 */
export interface TaxAlert extends Provenance {
  readonly code: TaxAlertCode;
  readonly severity: AlertSeverity;
  readonly year: number | null;
  readonly regime: string | null;
  readonly measured: AlertValue | null;
  readonly limit: AlertValue | null;
  /** For `tax_regime_not_calculated`, why. */
  readonly gap: TaxGap | null;
}

/** The tax of one rule for one year, and when it is paid. */
export interface TaxCharge {
  readonly ruleId: string;
  readonly levy: string;
  readonly kind: TaxKind;
  readonly basis: TaxBasis;
  /** The turnover or the profit (never below zero) the rule was applied to; null for a fixed amount. */
  readonly base: Money | null;
  readonly due: Figure<Money>;
  /** True when the rule's minimum raised the amount. */
  readonly minimumApplied: boolean;
  /**
   * The projection month, from 1, in which it is paid: the rule's payment month of the year after
   * the one it accrues in (D-212). Beyond the horizon for the last year; the cash flow notes it.
   */
  readonly paymentMonth: number;
}

/** One projection year: its turnover and operating profit before tax, and what is due on them. */
export interface TaxYear {
  /** Projection year, from 1. */
  readonly year: number;
  readonly turnover: Money;
  readonly profit: Money;
  readonly charges: readonly TaxCharge[];
  readonly total: Figure<Money>;
}

interface TaxAnalysisBase {
  readonly legalForm: LegalForm;
  /** True when G1 was "not sure yet" or missing and the sole proprietor was assumed (D-186). */
  readonly legalFormAssumed: boolean;
  readonly alerts: readonly TaxAlert[];
}

/** The taxes of every year of the projection under the regime of the country and legal form. */
export interface CalculatedTax extends TaxAnalysisBase {
  readonly status: 'calculated';
  readonly regime: string;
  readonly years: readonly TaxYear[];
}

/** No regime could be applied; the reason is `gap`. Nothing is guessed (CLAUDE.md rule 9). */
export interface UncalculatedTax extends TaxAnalysisBase {
  readonly status: 'not_calculated';
  readonly gap: TaxGap;
}

export type TaxAnalysis = CalculatedTax | UncalculatedTax;

/** The tax of one rule on one year: the amount, and whether its minimum raised it (D-211). */
export interface TaxDue {
  readonly amount: Money;
  /** What the rate was applied to; null for a fixed amount. */
  readonly base: Money | null;
  readonly minimumApplied: boolean;
}

const rule = (id: string): InputRef => ({ kind: 'rule', id });

function fail(taxRule: TaxRule, what: string): never {
  throw new EngineError('invalid_param', `Tax rule ${taxRule.id} ${what}.`);
}

/**
 * Checks that a rule is well formed, and throws `invalid_param` (or `invalid_date`) naming it if
 * not: a two-letter country code, an id, regime, levy and an http(s) source, real dates, a
 * verified rule that has a verification date, a payment month from 1 to 12, amounts in the rule's
 * currency and not negative, a fixed basis with only an amount, any other basis with exactly one
 * of a rate and brackets, and brackets that rise and end open. A malformed rule would give a wrong
 * tax, which is worse than none (CLAUDE.md rule 9).
 */
export function validateTaxRule(taxRule: TaxRule): void {
  if (!/^[A-Z]{2}$/.test(taxRule.countryCode)) fail(taxRule, 'needs a two-letter country code');
  if (taxRule.id === '' || taxRule.regime === '' || taxRule.levy === '') {
    fail(taxRule, 'needs an id, a regime and a levy');
  }
  if (!/^https?:\/\/\S+$/.test(taxRule.sourceUrl)) fail(taxRule, 'needs an http(s) source URL');
  referenceMonth(taxRule.effectiveFrom);
  if (taxRule.lastVerified !== null) referenceMonth(taxRule.lastVerified);
  if (taxRule.status === 'verified' && taxRule.lastVerified === null) {
    fail(taxRule, 'cannot be verified without a verification date');
  }
  if (
    !Number.isInteger(taxRule.paymentMonth) ||
    taxRule.paymentMonth < 1 ||
    taxRule.paymentMonth > 12
  ) {
    fail(taxRule, 'needs a payment month from 1 to 12');
  }
  const amounts = [
    taxRule.fixedAmount,
    taxRule.minimum,
    taxRule.turnoverCeiling,
    ...taxRule.brackets.map((bracket) => bracket.upTo),
  ].filter((amount) => amount !== null);
  if (amounts.some((amount) => amount.currency !== taxRule.currency || amount.minor < 0n)) {
    fail(taxRule, 'needs amounts in its currency that are not negative');
  }
  if (taxRule.basis === 'fixed') {
    if (taxRule.fixedAmount === null || taxRule.rate !== null || taxRule.brackets.length > 0) {
      fail(taxRule, 'needs a fixed amount and no rate or brackets for a fixed basis');
    }
    return;
  }
  if (taxRule.fixedAmount !== null) fail(taxRule, 'has a fixed amount but no fixed basis');
  if ((taxRule.rate === null) === (taxRule.brackets.length === 0)) {
    fail(taxRule, 'needs exactly one of a rate and brackets');
  }
  if (taxRule.rate !== null && compareRates(taxRule.rate, ZERO_RATE) < 0) {
    fail(taxRule, 'cannot have a negative rate');
  }
  let previous = 0n;
  taxRule.brackets.forEach((bracket, index) => {
    if ((index === taxRule.brackets.length - 1) !== (bracket.upTo === null)) {
      fail(taxRule, 'needs brackets that end with exactly one open to any amount');
    }
    if (bracket.upTo !== null) {
      if (bracket.upTo.minor <= previous) fail(taxRule, 'needs brackets in rising order');
      previous = bracket.upTo.minor;
    }
    if (compareRates(bracket.rate, ZERO_RATE) < 0) fail(taxRule, 'cannot have a negative rate');
  });
}

/**
 * The tax of progressive brackets: each bracket taxes only the part of the base inside it. The
 * parts times their rates are added exactly and rounded once, half away from zero (D-179).
 */
function marginalTax(brackets: readonly TaxBracket[], base: bigint): bigint {
  let lower = 0n;
  let exact = ZERO_RATE;
  for (const { upTo, rate } of brackets) {
    if (base <= lower) break;
    const top = upTo === null || upTo.minor > base ? base : upTo.minor;
    exact = addRates(exact, makeRate((top - lower) * rate.num, rate.den));
    lower = top;
  }
  return divRoundHalfAwayFromZero(exact.num, exact.den);
}

/**
 * The tax a rule charges for one year (SPEC §4, D-186): a turnover basis uses the year's turnover,
 * a profit basis the larger of the profit and zero, and a fixed basis its amount. A flat rate times
 * the base is rounded half away from zero to the minor unit; brackets are marginal and rounded
 * once for the whole sum; the minimum, when the rule has one, is the least the result can be, even
 * for a year with no turnover or profit. Pure. Throws `invalid_param` for a malformed rule and
 * `currency_mismatch` unless turnover and profit are in the rule's currency.
 */
export function taxDue(taxRule: TaxRule, turnover: Money, profit: Money): TaxDue {
  validateTaxRule(taxRule);
  const { currency } = taxRule;
  if (turnover.currency !== currency || profit.currency !== currency) {
    throw new EngineError('currency_mismatch', `Tax rule ${taxRule.id} is in ${currency}.`);
  }
  let base: Money | null = null;
  let minor: bigint;
  let minimumApplied = false;
  if (taxRule.fixedAmount !== null) {
    minor = taxRule.fixedAmount.minor;
  } else {
    base = taxRule.basis === 'turnover' ? turnover : maxMoney(profit, zeroMoney(currency));
    minor =
      taxRule.rate === null
        ? marginalTax(taxRule.brackets, base.minor)
        : divRoundHalfAwayFromZero(base.minor * taxRule.rate.num, taxRule.rate.den);
  }
  if (taxRule.minimum !== null && minor < taxRule.minimum.minor) {
    minor = taxRule.minimum.minor;
    minimumApplied = true;
  }
  return { amount: makeMoney(minor, currency), base, minimumApplied };
}

/**
 * What a tax rule makes of the figures built on it: they are external, and are validated with
 * high confidence only when the rule was verified against its source; a fixture or an unverified
 * rule makes them unvalidated with low confidence (D-181, D-211).
 */
function ruleProvenance(taxRule: TaxRule): Provenance {
  const verified = taxRule.status === 'verified';
  return {
    source: 'external',
    confidence: verified ? 'high' : 'low',
    validated: verified,
    inputs: [{ kind: 'country_pack_item', id: taxRule.id }],
  };
}

function alert(
  code: TaxAlertCode,
  inputs: readonly Provenance[],
  fields: Partial<Pick<TaxAlert, 'year' | 'regime' | 'measured' | 'limit' | 'gap'>>,
): TaxAlert {
  return {
    code,
    severity: TAX_ALERT_SEVERITY[code],
    year: null,
    regime: null,
    measured: null,
    limit: null,
    gap: null,
    ...fields,
    ...combineProvenance(inputs, [rule(`alert.${code}`)]),
  };
}

/** The rules in force for the country and legal form, one per levy, or why there are none to use. */
function regimeRules(
  context: TaxContext,
  input: EngineInput,
  legalForm: LegalForm,
): { rules: readonly TaxRule[] } | { gap: TaxGap } {
  const candidates = context.rules.filter(
    (candidate) => candidate.countryCode === input.country && candidate.legalForm === legalForm,
  );
  candidates.forEach(validateTaxRule);
  const inForce = candidates.filter((candidate) => candidate.effectiveFrom <= input.referenceDate);
  const regimes = [...new Set(inForce.map((candidate) => candidate.regime))].sort();
  if (regimes.length === 0) return { gap: { code: 'no_rule' } };
  if (regimes.length > 1) return { gap: { code: 'ambiguous_regime', regimes } };

  // A newer rule of the same levy replaces an older one; two taking effect on one day is a data error.
  const latest = new Map<string, TaxRule>();
  for (const candidate of inForce) {
    const current = latest.get(candidate.levy);
    if (current?.effectiveFrom === candidate.effectiveFrom) {
      fail(candidate, `and ${current.id} take effect on the same day for ${candidate.levy}`);
    }
    if (current === undefined || candidate.effectiveFrom > current.effectiveFrom) {
      latest.set(candidate.levy, candidate);
    }
  }
  const rules = [...latest.values()].sort(
    (a, b) =>
      (a.kind === b.kind ? 0 : a.kind === 'tax' ? -1 : 1) ||
      (a.levy < b.levy ? -1 : a.levy > b.levy ? 1 : 0),
  );
  const other = rules.find((candidate) => candidate.currency !== input.currency);
  if (other !== undefined)
    return { gap: { code: 'rule_other_currency', currency: other.currency } };
  return { rules };
}

/** The sum of a year's operating profit or revenue over the months of one projection year. */
function yearTotal(line: readonly Money[], year: number, currency: CurrencyCode): Money {
  return sumMoney(currency, line.slice((year - 1) * 12, year * 12));
}

/**
 * The tax engine for a run (SPEC §4, D-186, D-211, D-212): for each projection year, the tax of
 * every rule of the regime, accrued on that year's turnover and operating profit before tax, and
 * the projection month it is paid in. The regime comes from the country and from G1 (the sole
 * proprietor when G1 is "not sure yet" or missing, flagged by `legalFormAssumed`) among the rules
 * the caller passes that take effect on or before the run's reference date; a country or legal
 * form with no rule, rules of several regimes, or rules in another currency are `not_calculated`,
 * never guessed, and raise `tax_regime_not_calculated`. Turnover above the regime's lowest ceiling
 * raises `turnover_above_regime_ceiling` for that year, and above the caller's VAT threshold
 * `turnover_above_vat_threshold` (VAT itself is not calculated). Every figure carries the rule it
 * came from (`country_pack_item`), so a fixture or unverified rule shows (D-181).
 * Throws `invalid_param` for a malformed rule and `currency_mismatch` if the projection was made
 * in another currency than the input or the VAT threshold is in another currency.
 */
export function taxAnalysis(
  input: EngineInput,
  projection: OperatingProjection,
  context: TaxContext = { rules: [] },
): TaxAnalysis {
  if (projection.currency !== input.currency) {
    throw new EngineError('currency_mismatch', 'The projection and the input differ in currency.');
  }
  const { currency } = input;
  const legalForm = input.legalForm.value;
  const legalFormAssumed = input.notes.some((note) => note.code === 'legal_form_assumed_sole');
  const years = projection.calendar.horizonMonths / 12;
  const turnovers = Array.from({ length: years }, (_, index) =>
    yearTotal(projection.revenue.monthly, index + 1, currency),
  );
  const profits = Array.from({ length: years }, (_, index) =>
    yearTotal(projection.operatingProfit.monthly, index + 1, currency),
  );

  const vat = context.vatThreshold ?? null;
  const vatAlerts = (): TaxAlert[] =>
    vat === null
      ? []
      : turnovers.flatMap((turnover, index) =>
          compareMoney(turnover, vat.value) > 0
            ? [
                alert('turnover_above_vat_threshold', [projection.revenue.provenance, vat], {
                  year: index + 1,
                  measured: { kind: 'money', money: turnover },
                  limit: { kind: 'money', money: vat.value },
                }),
              ]
            : [],
        );

  const selected = regimeRules(context, input, legalForm);
  if ('gap' in selected) {
    return {
      status: 'not_calculated',
      legalForm,
      legalFormAssumed,
      gap: selected.gap,
      alerts: [
        alert('tax_regime_not_calculated', [input.legalForm], { gap: selected.gap }),
        ...vatAlerts(),
      ],
    };
  }

  const regime = at(selected.rules, 0).regime;
  const taxYears: TaxYear[] = turnovers.map((turnover, index) => {
    const year = index + 1;
    const profit = at(profits, index);
    const charges = selected.rules.map((taxRule): TaxCharge => {
      const result = taxDue(taxRule, turnover, profit);
      const inputs: Provenance[] = [ruleProvenance(taxRule)];
      if (taxRule.basis === 'turnover') inputs.push(projection.revenue.provenance);
      if (taxRule.basis === 'profit') inputs.push(projection.operatingProfit.provenance);
      return {
        ruleId: taxRule.id,
        levy: taxRule.levy,
        kind: taxRule.kind,
        basis: taxRule.basis,
        base: result.base,
        due: combineFigures(result.amount, inputs, [rule(TAX_RULES.due)]),
        minimumApplied: result.minimumApplied,
        paymentMonth: year * 12 + taxRule.paymentMonth,
      };
    });
    return {
      year,
      turnover,
      profit,
      charges,
      total: combineFigures(
        sumMoney(
          currency,
          charges.map((charge) => charge.due.value),
        ),
        charges.map((charge) => charge.due),
        [rule(TAX_RULES.yearTotal)],
      ),
    };
  });

  const ceilings = selected.rules.flatMap((taxRule) =>
    taxRule.turnoverCeiling === null ? [] : [{ taxRule, ceiling: taxRule.turnoverCeiling }],
  );
  const lowest = ceilings.reduce<(typeof ceilings)[number] | null>(
    (low, next) => (low === null || next.ceiling.minor < low.ceiling.minor ? next : low),
    null,
  );
  const ceilingAlerts =
    lowest === null
      ? []
      : turnovers.flatMap((turnover, index) =>
          compareMoney(turnover, lowest.ceiling) > 0
            ? [
                alert(
                  'turnover_above_regime_ceiling',
                  [projection.revenue.provenance, ruleProvenance(lowest.taxRule)],
                  {
                    year: index + 1,
                    regime,
                    measured: { kind: 'money', money: turnover },
                    limit: { kind: 'money', money: lowest.ceiling },
                  },
                ),
              ]
            : [],
        );

  return {
    status: 'calculated',
    legalForm,
    legalFormAssumed,
    regime,
    years: taxYears,
    alerts: [...ceilingAlerts, ...vatAlerts()],
  };
}
