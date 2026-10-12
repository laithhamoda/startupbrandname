import { describe, expect, it } from 'vitest';
import { suggestChanges } from './changes';
import {
  changesAgreement,
  decisionAgreement,
  factorTo,
  moneyTo,
  runGolden,
  type CaseName,
} from './golden-projects';
import { VERDICT_CASES } from './verdict-cases';

const named = (name: CaseName) => {
  const found = VERDICT_CASES.find((candidate) => candidate.name === name);
  if (found === undefined) throw new Error(`no case ${name}`);
  return found;
};

describe('the synthetic cases of the verdict', () => {
  it('are four, with distinct names and titles, in the order of the page', () => {
    expect(VERDICT_CASES.map((candidate) => candidate.name)).toEqual([
      'case-good',
      'case-borderline',
      'case-negative-margin',
      'case-funding-gap',
    ]);
    expect(new Set(VERDICT_CASES.map((candidate) => candidate.title)).size).toBe(4);
  });

  it.each(VERDICT_CASES)('$name: the engine agrees with every hand computation', (candidate) => {
    const run = runGolden(candidate);
    const agreement = decisionAgreement(run, candidate.decision);
    expect(agreement.criteria).toEqual(candidate.decision.criteria.map(() => true));
    expect(agreement).toMatchObject({
      score: true,
      blockers: true,
      verdict: true,
      confidence: true,
      plan: true,
    });
    expect(candidate.decision.criteria).toHaveLength(11);
  });

  it.each(VERDICT_CASES)('$name: uses no tax rule, no row and no F7 variant', (candidate) => {
    expect(candidate.tax.rules).toEqual([]);
    expect(candidate.rows).toEqual([]);
    expect(candidate.paymentVariants).toEqual([]);
  });

  it('disagree piece by piece when the hand computation differs from the engine', () => {
    const base = named('case-good');
    const run = runGolden(base);
    const decision = base.decision;
    const [first] = decision.criteria;
    if (first === undefined) throw new Error('no row');
    const changed = decisionAgreement(run, {
      ...decision,
      criteria: [
        { ...first, status: 'fail' },
        ...decision.criteria.slice(1),
        { ...first, id: 'margin_positive' },
      ],
      evaluated: 9,
      blockers: ['no_break_even_in_window'],
      verdict: 'revise',
      confidence: 'medium',
      sound: 3,
      plan: ['price', 'sales', 'worry'],
    });
    expect(changed.criteria.slice(0, 2)).toEqual([false, true]);
    // A hand row with no criterion behind it (a twelfth) never agrees.
    expect(changed.criteria.at(-1)).toBe(false);
    expect(changed).toMatchObject({
      score: false,
      blockers: false,
      verdict: false,
      confidence: false,
      plan: false,
    });
    expect(decisionAgreement(run, { ...decision, plan: ['worry', 'price'] }).plan).toBe(false);
    expect(decisionAgreement(run, { ...decision, sound: 4 }).confidence).toBe(false);
    expect(decisionAgreement(run, { ...decision, confidence: 'low' }).confidence).toBe(false);
  });

  it('good: 10 of 10, go, and the same numbers with three doubtful figures are revise', () => {
    const run = runGolden(named('case-good'));
    expect(run.verdict.verdict.value).toBe('go');
    expect([run.feasibility.passed, run.feasibility.evaluated]).toEqual([10, 10]);
    expect(run.cash.cashFlow.status === 'ok' && run.cash.cashFlow.payback.value).toBe(3);
    const doubtful = runGolden({
      ...named('case-good'),
      provenance: {
        ...named('case-good').provenance,
        F1: { source: 'user', confidence: 'low', validated: false },
        F3: { source: 'user', confidence: 'low', validated: false },
        F4: { source: 'user', confidence: 'low', validated: false },
      },
    });
    expect(doubtful.confidence.level.value).toBe('low');
    expect(doubtful.verdict.verdict.value).toBe('revise');
  });

  it('borderline: 7 of 10 is 70 percent, one criterion short of 80, and revise', () => {
    const run = runGolden(named('case-borderline'));
    expect(run.verdict.verdict.value).toBe('revise');
    expect([run.feasibility.passed, run.feasibility.evaluated]).toEqual([7, 10]);
    expect(run.cash.cashFlow.status === 'ok' && run.cash.cashFlow.fundingNeed.value.minor).toBe(
      9_000_000n,
    );
    expect(run.cash.cashFlow.status === 'ok' && run.cash.cashFlow.payback.value).toBe(15);
    expect(run.scenarios.conservative.breakEvenMonth.value).toBeNull();
    expect(run.tornado.rows.map((row) => row.swing.value.minor)).toEqual([
      15_360_000n,
      7_680_000n,
      7_680_000n,
      4_800_000n,
    ]);
  });

  it('negative margin: only the margin stops it, the loan lifts the funding blocker', () => {
    const run = runGolden(named('case-negative-margin'));
    expect(run.verdict.verdict.value).toBe('stop');
    expect(run.verdict.blockers.map((blocker) => blocker.code)).toEqual(['margin_not_positive']);
    expect(run.input.outsideFinancing.value).toBe(true);
    expect(run.pricing.floor?.value.minor).toBe(14_500n);
    expect(run.cash.cashFlow.status === 'ok' && run.cash.cashFlow.fundingNeed.value.minor).toBe(
      67_800_000n,
    );
    // Without the loan the funding blocker holds as well, after the margin.
    const savings = runGolden({
      ...named('case-negative-margin'),
      answers: {
        ...named('case-negative-margin').answers,
        H3: { status: 'answered', value: { values: ['self'] } },
      },
    });
    expect(savings.verdict.blockers.map((blocker) => blocker.code)).toEqual([
      'margin_not_positive',
      'funding_need_above_capital_multiple',
    ]);
  });

  it('funding gap: 80 percent passes the line, and the blocker stops it', () => {
    const run = runGolden(named('case-funding-gap'));
    expect(run.verdict.verdict.value).toBe('stop');
    expect([run.feasibility.passed, run.feasibility.evaluated]).toEqual([8, 10]);
    expect(run.verdict.holdBacks).toEqual([]);
    expect(run.cash.cashFlow.status === 'ok' && run.cash.cashFlow.fundingNeed.value.minor).toBe(
      17_000_000n,
    );
    expect(run.cash.cashFlow.status === 'ok' && run.cash.cashFlow.payback.value).toBe(13);
  });

  it('funding gap: exactly twice the capital is no blocker, and an outside source lifts it', () => {
    const base = named('case-funding-gap');
    const at = (setup: number, values: string[]) =>
      runGolden({
        ...base,
        answers: {
          ...base.answers,
          F5: {
            status: 'answered',
            value: { items: [{ label: 'S', amount: setup, currency: 'JOD' }] },
          },
          H3: { status: 'answered', value: { values } },
        },
      });
    expect(at(16000, ['self', 'family']).verdict.blockers).toEqual([]);
    expect(at(17000, ['self', 'family', 'grant']).verdict.blockers).toEqual([]);
    expect(at(17000, ['self', 'family']).verdict.blockers).toHaveLength(1);
  });
});

describe('the changes of the synthetic cases', () => {
  it.each(VERDICT_CASES)(
    '$name: the engine agrees with every hand computed change',
    (candidate) => {
      const suggested = suggestChanges(runGolden(candidate), candidate.tax);
      const agreement = changesAgreement(suggested, candidate.decision);
      expect(agreement.list).toBe(true);
      expect(agreement.changes).toEqual(candidate.decision.changes.map(() => true));
      expect(suggested.complete).toBe(true);
    },
  );

  it('has three changes for the borderline and negative margin cases, one and two rethinks for the gap', () => {
    const counts = Object.fromEntries(
      VERDICT_CASES.map((candidate) => [
        candidate.name,
        [candidate.decision.changes.length, candidate.decision.rethink.length],
      ]),
    );
    expect(counts).toEqual({
      'case-good': [0, 0],
      'case-borderline': [3, 0],
      'case-negative-margin': [3, 0],
      'case-funding-gap': [1, 2],
    });
  });

  it('disagree piece by piece when the hand computation differs from the engine', () => {
    const base = named('case-negative-margin');
    const suggested = suggestChanges(runGolden(base), base.tax);
    const decision = base.decision;
    const [first, second] = decision.changes;
    if (first === undefined || second === undefined) throw new Error('no change');
    const check = (changes: typeof decision.changes, rethink = decision.rethink) =>
      changesAgreement(suggested, { ...decision, changes, rethink });
    const rest = decision.changes.slice(1);
    // One field at a time.
    expect(check([{ ...first, levers: ['price'] }, ...rest]).changes[0]).toBe(false);
    expect(check([{ ...first, to: [moneyTo(7_501n)] }, ...rest]).changes[0]).toBe(false);
    expect(check([{ ...first, to: [factorTo(3n, 4n)] }, ...rest]).changes[0]).toBe(false);
    expect(check([{ ...first, to: [] }, ...rest]).changes[0]).toBe(false);
    expect(check([{ ...first, premium: true }, ...rest]).changes[0]).toBe(false);
    expect(check([{ ...first, reachesThreshold: false }, ...rest]).changes[0]).toBe(false);
    expect(check([{ ...first, passed: 7 }, ...rest]).changes[0]).toBe(false);
    expect(check([{ ...first, evaluated: 9 }, ...rest]).changes[0]).toBe(false);
    expect(check([{ ...first, verdict: 'revise' }, ...rest]).changes[0]).toBe(false);
    // The second change is a pair: a lever's target of the wrong kind or a missing one fails.
    expect(
      check([first, { ...second, to: [moneyTo(12_100n)] }, ...decision.changes.slice(2)])
        .changes[1],
    ).toBe(false);
    expect(
      check([
        first,
        { ...second, to: [factorTo(1n, 1n), moneyTo(9_480n)] },
        ...decision.changes.slice(2),
      ]).changes[1],
    ).toBe(false);
    // A change with no hand row behind it never agrees, and the list is then not the expected one.
    const short = check([first]);
    expect(short.changes).toEqual([true, false, false]);
    expect(short.list).toBe(false);
    expect(check(decision.changes, ['price']).list).toBe(false);
    expect(check(decision.changes).list).toBe(true);
  });
});
