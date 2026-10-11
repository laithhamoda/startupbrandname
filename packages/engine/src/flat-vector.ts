import type { Answers } from '@sbn/question-bank';
import type { FigureConfidence } from './figure';
import type { ProjectContext, ProvenanceBySteps, StoredProvenance } from './input';
import { runEngine, type EngineRun } from './run';
import type { EngineParamOverrides } from './params';
import type { TaxContext } from './tax';

/*
 * The flat vector of the engine's own fixtures (D-218, D-247): 400 units a month in months 1, 6
 * and 12, a price of 10, a variable cost of 4 and fixed costs of 1,000 a month, with no payroll,
 * marketing, seasonality, inflation or tax. With set-up costs of 3,000 and capital of 5,000 to
 * 8,000 the base profit is 1,400 a month, break-even is month 1, the funding need is 3,000, the
 * price floor is 4 + 1,000 / 400 = 6.5 and the conservative scenario breaks even in month 4
 * (240 units at 4.4 earn 344 a month after three empty months). The tests of the feasibility
 * score, the verdict, overall confidence and the validation plan, the property test and the
 * synthetic cases of the review page are all built on it. Nothing here is market data.
 */

/** The project the vector belongs to: a Jordanian project in dinars, run on a fixed date. */
export const FLAT_CONTEXT: ProjectContext = {
  country: 'JO',
  currency: 'JOD',
  mode: 'full',
  referenceDate: '2026-10-05',
};

export const real = (value: unknown) => ({ status: 'answered' as const, value });

/** A list of cost items in dinars. */
export const jodItems = (...rows: readonly (readonly [string, number])[]) => ({
  items: rows.map(([label, amount]) => ({ label, amount, currency: 'JOD' })),
});

/**
 * The flat vector as answers, with everything the 11 criteria read except a subscription: A5 of
 * 5,000 to 8,000, A7 of three to six months, H5 of 12 months, E7 of 500 units a month, and H3
 * naming only the founder's own savings. `more` replaces any of them.
 */
export function flatAnswers(more: Answers = {}): Answers {
  return {
    F1: real({ amount: 10, currency: 'JOD' }),
    F3: real(jodItems(['Materials', 4])),
    F4: real(jodItems(['Rent', 1000])),
    F5: real(jodItems(['Set-up', 3000])),
    F6: real({ month1: 400, month6: 400, month12: 400 }),
    A5: real({ min: 5000, max: 8000, currency: 'JOD' }),
    A7: real('3to6'),
    H5: real('m12'),
    E7: real(500),
    H3: real({ values: ['self'] }),
    H6: real('هل سيدفع العملاء هذا السعر؟'),
    ...more,
  };
}

const STORED: Readonly<Record<FigureConfidence, StoredProvenance>> = {
  high: { source: 'user', confidence: 'high', validated: true },
  medium: { source: 'user', confidence: 'medium', validated: true },
  low: { source: 'user', confidence: 'low', validated: false },
};

/** The five pivotal answers F1, F3, F4, F5 and F6 stored at one confidence each. */
export function flatProvenance(
  levels: Partial<Record<'F1' | 'F3' | 'F4' | 'F5' | 'F6', FigureConfidence>> = {},
  fallback: FigureConfidence = 'high',
): ProvenanceBySteps {
  const id = (key: 'F1' | 'F3' | 'F4' | 'F5' | 'F6') => STORED[levels[key] ?? fallback];
  return {
    F1: id('F1'),
    F3: id('F3'),
    F4: id('F4'),
    F5: id('F5'),
    F6: id('F6'),
    A5: STORED.high,
    A7: STORED.high,
    H5: STORED.high,
    E7: STORED.high,
    H3: STORED.high,
    H6: STORED.high,
  };
}

/** Runs the engine on answers; throws when they cannot be calculated (the vector always can). */
export function runFlat(
  answers: Answers = flatAnswers(),
  provenance: ProvenanceBySteps = flatProvenance(),
  overrides: EngineParamOverrides = {},
  tax: TaxContext = { rules: [] },
): EngineRun {
  const result = runEngine(answers, provenance, FLAT_CONTEXT, tax, overrides);
  if (result.status !== 'ok') throw new Error(`not calculable: ${JSON.stringify(result.reasons)}`);
  return result.run;
}
