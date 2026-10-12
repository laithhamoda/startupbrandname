import { type EngineRun, type Figure, moneyToMajorString, type Money } from '@sbn/engine';
import type { CanvasInput, CanvasTotal } from '@sbn/report/canvas';
import { amountText } from '@sbn/report/canvas';

/** How the totals are written: the page language and the label after a currency. */
export type TotalsContext = Pick<CanvasInput, 'language' | 'currencyLabel'>;

function total(
  kind: CanvasTotal['kind'],
  figure: Figure<Money>,
  context: TotalsContext,
): CanvasTotal {
  const { value } = figure;
  return {
    kind,
    text: amountText(moneyToMajorString(value), value.currency, context),
    provenance: {
      source: figure.source,
      confidence: figure.confidence,
      validated: figure.validated,
    },
  };
}

/**
 * The engine's cost totals for the cost structure block (D-231): the monthly fixed costs, the
 * variable cost of one unit and the set-up total, each with the provenance the engine gave it.
 * The numbers are the engine's, written for the page here and nowhere else (rule 1). The set-up
 * total is left out when the engine had no set-up costs to add.
 */
export function canvasTotals(run: EngineRun, context: TotalsContext): CanvasTotal[] {
  const { fixedCosts, variableCost, setupCosts } = run.input;
  return [
    total('fixedMonthly', fixedCosts, context),
    total('variableUnit', variableCost, context),
    ...(setupCosts ? [total('setup', setupCosts, context)] : []),
  ];
}
