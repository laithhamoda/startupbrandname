import type { CashFlow } from './cash-flow';
import type { OverallConfidence } from './confidence';
import type { Feasibility } from './feasibility';
import {
  combineFigures,
  combineProvenance,
  type Figure,
  type InputRef,
  type Provenance,
} from './figure';
import type { EngineInput } from './input';
import type { EngineParams } from './params';
import type { OperatingProjection } from './projection';
import type { UnitEconomics } from './unit-economics';

/** The stable IDs of the verdict rules, listed in the inputs of the figures they produce (D-181). */
export const VERDICT_RULES = {
  verdict: 'verdict.verdict',
  blocker: 'verdict.blocker',
} as const;

/** The verdict: go (امضِ), revise (عدّل) or stop (توقّف). The report words it (D-227). */
export type Verdict = 'go' | 'revise' | 'stop';

/**
 * A condition that stops a project whatever its score (D-227): the contribution margin is zero or
 * less; no break-even within the window in the base case (checked while the margin is positive,
 * since a margin of zero or less already stops the project); a funding need above the multiple of
 * the largest capital of A5 when H3 names no outside source.
 */
export type BlockerCode =
  'margin_not_positive' | 'no_break_even_in_window' | 'funding_need_above_capital_multiple';

/** A blocker that holds, with the provenance of the figures it compared. */
export interface Blocker extends Provenance {
  readonly code: BlockerCode;
}

/**
 * Why a project that is not stopped is not `go` either: `score_below_line` (the score is under the
 * go line), `no_score` (nothing was evaluated) or `confidence_low` (overall confidence is low).
 * Empty for a project that meets every condition of `go`.
 */
export type HoldBack = 'score_below_line' | 'no_score' | 'confidence_low';

/** The verdict of a project (D-227): the word, the blockers that hold, and what holds a `go` back. */
export interface VerdictResult {
  readonly verdict: Figure<Verdict>;
  readonly blockers: readonly Blocker[];
  readonly holdBacks: readonly HoldBack[];
}

const blocker = (code: BlockerCode, used: readonly Provenance[]): Blocker => ({
  code,
  ...combineProvenance(used, [{ kind: 'rule', id: `${VERDICT_RULES.blocker}.${code}` }]),
});

/**
 * The blockers that hold, in the order of D-227. The funding blocker needs outside financing to be
 * `false`: an unanswered H3 (null) never stops a project. The comparison is exact: the funding
 * need times the multiple's denominator against the largest capital times its numerator, in
 * minor units, so exactly twice the capital is not a blocker and one minor unit more is.
 */
export function blockersOf(
  input: EngineInput,
  projection: OperatingProjection,
  unit: UnitEconomics,
  flow: CashFlow,
  params: EngineParams,
): readonly Blocker[] {
  const found: Blocker[] = [];
  if (unit.status === 'blocked') {
    found.push(blocker('margin_not_positive', [unit.contributionMargin]));
  } else {
    const window = Math.min(
      params.feasibilityWindowMonths.value,
      projection.calendar.horizonMonths,
    );
    const month = unit.breakEvenMonth.value;
    if (month === null || month > window) {
      found.push(
        blocker('no_break_even_in_window', [unit.breakEvenMonth, params.feasibilityWindowMonths]),
      );
    }
  }
  const capital = input.capital.value;
  if (flow.status === 'ok' && capital !== null && input.outsideFinancing.value === false) {
    const multiple = params.fundingBlockerMultiple.value;
    if (flow.fundingNeed.value.minor * multiple.den > capital.max.minor * multiple.num) {
      found.push(
        blocker('funding_need_above_capital_multiple', [
          flow.fundingNeed,
          input.capital,
          input.outsideFinancing,
          params.fundingBlockerMultiple,
        ]),
      );
    }
  }
  return found;
}

/**
 * The verdict (D-227): `stop` when any blocker holds; `go` when the score is at least the go line
 * (passed x denominator >= evaluated x numerator, exact integers), no blocker holds and overall
 * confidence is medium or high; `revise` otherwise. The score is not a probability of success.
 * Pure and deterministic.
 */
export function verdictOf(
  blockers: readonly Blocker[],
  feasibility: Feasibility,
  confidence: OverallConfidence,
  params: EngineParams,
): VerdictResult {
  const holdBacks: HoldBack[] = [];
  const { score } = feasibility;
  const line = params.goScoreLine.value;
  if (score === null) holdBacks.push('no_score');
  else if (BigInt(feasibility.passed) * line.den < BigInt(feasibility.evaluated) * line.num) {
    holdBacks.push('score_below_line');
  }
  if (confidence.level.value === 'low') holdBacks.push('confidence_low');

  const verdict: Verdict = blockers.length > 0 ? 'stop' : holdBacks.length > 0 ? 'revise' : 'go';
  const used: Provenance[] = [
    confidence.level,
    params.goScoreLine,
    ...(score === null ? [] : [score]),
    ...blockers,
  ];
  const rules: InputRef[] = [{ kind: 'rule', id: VERDICT_RULES.verdict }];
  return { verdict: combineFigures(verdict, used, rules), blockers, holdBacks };
}
