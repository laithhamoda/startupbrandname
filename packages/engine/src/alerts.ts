import { combineProvenance, type Figure, type InputRef, type Provenance } from './figure';
import type { EngineInput, MonthLimit } from './input';
import { compareMoney, makeMoney, type Money } from './money';
import type { EngineParams } from './params';
import type { Pricing } from './pricing';
import type { OperatingProjection } from './projection';
import { compareRates, type Rate } from './rate';
import type { UnitEconomics } from './unit-economics';

/**
 * Every alert T8 and T7 can raise (SPEC §4; D-190, D-207, D-210). The code is stable: the report
 * and the mentor branch on it and write the sentence; the engine never produces text.
 */
export type AlertCode =
  | 'cm_not_positive'
  | 'break_even_units_above_capacity'
  | 'break_even_month_above_target'
  | 'break_even_month_above_runway'
  | 'setup_costs_above_capital'
  | 'setup_costs_within_capital_range'
  | 'price_below_floor'
  | 'ltv_to_cac_below_minimum';

/** How serious an alert is: `block` stops the analysis, `warning` is shown prominently, `note` softly. */
export type AlertSeverity = 'block' | 'warning' | 'note';

/** The severity of each alert (D-210). */
export const ALERT_SEVERITY: Readonly<Record<AlertCode, AlertSeverity>> = {
  cm_not_positive: 'block',
  break_even_units_above_capacity: 'warning',
  break_even_month_above_target: 'warning',
  break_even_month_above_runway: 'warning',
  setup_costs_above_capital: 'warning',
  setup_costs_within_capital_range: 'note',
  price_below_floor: 'warning',
  ltv_to_cac_below_minimum: 'warning',
};

/**
 * A value an alert compared. `months_after` is "later than month N": a break-even that the whole
 * horizon did not reach (D-210).
 */
export type AlertValue =
  | { readonly kind: 'money'; readonly money: Money }
  | { readonly kind: 'units'; readonly units: bigint }
  | { readonly kind: 'months'; readonly months: number }
  | { readonly kind: 'months_after'; readonly months: number }
  | { readonly kind: 'ratio'; readonly ratio: Rate };

/**
 * A raised alert: a code, a severity, what was measured against what, and the provenance of the
 * inputs it used (D-181). `lowerLimit` is the other end of a range (A5's minimum).
 */
export interface Alert extends Provenance {
  readonly code: AlertCode;
  readonly severity: AlertSeverity;
  readonly measured: AlertValue;
  readonly limit: AlertValue;
  readonly lowerLimit?: AlertValue;
}

const money = (amount: Money): AlertValue => ({ kind: 'money', money: amount });
const months = (count: number): AlertValue => ({ kind: 'months', months: count });

function raise(
  code: AlertCode,
  inputs: readonly Provenance[],
  measured: AlertValue,
  limit: AlertValue,
  lowerLimit?: AlertValue,
): Alert {
  const rule: InputRef = { kind: 'rule', id: `alert.${code}` };
  return {
    code,
    severity: ALERT_SEVERITY[code],
    measured,
    limit,
    ...(lowerLimit === undefined ? {} : { lowerLimit }),
    ...combineProvenance(inputs, [rule]),
  };
}

/**
 * The break-even month against a limit (A7 or H5). The alert is raised only when the limit is
 * surely exceeded (D-190): a break-even month above the bucket's upper bound; or a break-even that
 * the horizon did not reach, when the bound lies within the horizon. A top bucket ("more than 12
 * months") and an unset answer have no bound, so nothing is raised.
 */
function lateBreakEven(
  code: 'break_even_month_above_target' | 'break_even_month_above_runway',
  breakEvenMonth: Figure<number | null>,
  limit: Figure<MonthLimit>,
  horizon: number,
): Alert | null {
  if (limit.value.kind !== 'within') return null;
  const bound = limit.value.months;
  const found = breakEvenMonth.value;
  if (found !== null) {
    return found > bound
      ? raise(code, [breakEvenMonth, limit], months(found), months(bound))
      : null;
  }
  return bound <= horizon
    ? raise(code, [breakEvenMonth, limit], { kind: 'months_after', months: horizon }, months(bound))
    : null;
}

/**
 * The alerts of T8 and T7 for one project, in the order of D-190: CM not positive (a block); BE_units
 * above the capacity E7; BE_month above H5, then above A7; F5 above A5's maximum (the H3 funding
 * alert) or, softer, within A5's range; F1 below the floor; LTV / CAC below the minimum. An alert
 * whose inputs are unknown, missing or not comparable is not evaluated, and the notes of the
 * adapter say why (D-200). While the contribution margin is not positive, nothing that needs a
 * break-even is evaluated. Pure; throws nothing for valid inputs.
 */
export function economicsAlerts(
  input: EngineInput,
  projection: OperatingProjection,
  unit: UnitEconomics,
  prices: Pricing,
  params: EngineParams,
): readonly Alert[] {
  const alerts: Alert[] = [];
  const add = (alert: Alert | null) => {
    if (alert !== null) alerts.push(alert);
  };

  if (unit.status === 'blocked') {
    alerts.push(
      raise(
        'cm_not_positive',
        [unit.contributionMargin],
        money(unit.contributionMargin.value),
        money(makeMoney(0n, input.currency)),
      ),
    );
  } else {
    const capacity = input.capacity.value;
    if (capacity !== null && unit.breakEvenUnits.value > capacity) {
      alerts.push(
        raise(
          'break_even_units_above_capacity',
          [unit.breakEvenUnits, input.capacity],
          { kind: 'units', units: unit.breakEvenUnits.value },
          { kind: 'units', units: capacity },
        ),
      );
    }
    const horizon = projection.calendar.horizonMonths;
    add(
      lateBreakEven(
        'break_even_month_above_target',
        unit.breakEvenMonth,
        input.breakEvenTarget,
        horizon,
      ),
    );
    add(lateBreakEven('break_even_month_above_runway', unit.breakEvenMonth, input.runway, horizon));
  }

  // F5 against A5, in the project currency only (D-190, D-113).
  const setup = input.setupCosts;
  const capital = input.capital.value;
  if (setup !== null && capital !== null && capital.max.currency === setup.value.currency) {
    const range = { lowerLimit: money(capital.min), limit: money(capital.max) };
    if (compareMoney(setup.value, capital.max) > 0) {
      alerts.push(
        raise(
          'setup_costs_above_capital',
          [setup, input.capital],
          money(setup.value),
          range.limit,
          range.lowerLimit,
        ),
      );
    } else if (compareMoney(setup.value, capital.min) > 0) {
      alerts.push(
        raise(
          'setup_costs_within_capital_range',
          [setup, input.capital],
          money(setup.value),
          range.limit,
          range.lowerLimit,
        ),
      );
    }
  }

  if (prices.floor !== null && compareMoney(input.price.value, prices.floor.value) < 0) {
    alerts.push(
      raise(
        'price_below_floor',
        [input.price, prices.floor],
        money(input.price.value),
        money(prices.floor.value),
      ),
    );
  }

  if (unit.status === 'ok') {
    const ratio = unit.subscription?.ltvToCac ?? null;
    if (ratio !== null && compareRates(ratio.value, params.ltvCacMinimum.value) < 0) {
      alerts.push(
        raise(
          'ltv_to_cac_below_minimum',
          [ratio, params.ltvCacMinimum],
          { kind: 'ratio', ratio: ratio.value },
          { kind: 'ratio', ratio: params.ltvCacMinimum.value },
        ),
      );
    }
  }
  return alerts;
}
