import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  GOLDEN_PROJECTS,
  headlineValue,
  runGolden,
  runWithPayment,
  sameValue,
  type Expected,
  type GoldenName,
  type GoldenProject,
} from './golden-projects';
import { makeMoney } from './money';
import { goldenReviewEntries, renderReviewPage } from './review-page';
import { makeRate } from './rate';
import type { EngineRun } from './run';
import { serialiseRun } from './serialise';
import type { ScenarioResult } from './scenarios';

/*
 * The golden projects (D-222). Each project below has its headline numbers computed by hand in
 * golden-projects.ts (the same text the owner review page shows) and asserted here; the whole
 * EngineRun serialised is packages/engine/golden/<name>.json. A changed formula shows as a diff in
 * that file. To accept a change on purpose, run the tests with UPDATE_GOLDEN=1 and read the diff.
 */

const GOLDEN_DIR = fileURLToPath(new URL('../golden/', import.meta.url));
const REVIEW_PAGE = fileURLToPath(
  new URL('../../../docs/engine-review/index.html', import.meta.url),
);

/** True when the run should rewrite the golden files instead of comparing with them. */
const updating = (): boolean => {
  const flag = process.env.UPDATE_GOLDEN;
  if (flag === undefined || flag === '') return false;
  // A rewrite in CI would make a changed number pass unseen (D-222).
  const ci = process.env.CI;
  if (ci !== undefined && ci !== '' && ci !== 'false') {
    throw new Error('UPDATE_GOLDEN must not be set in CI: it would hide a changed number.');
  }
  return true;
};

/** Compares `text` with the file, or writes the file when UPDATE_GOLDEN is set. */
export function matchFile(path: string, text: string): void {
  if (updating()) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, text, 'utf8');
    return;
  }
  let stored: string;
  try {
    stored = readFileSync(path, 'utf8');
  } catch {
    throw new Error(
      `${path} does not exist. Run the tests once with UPDATE_GOLDEN=1 to create it.`,
    );
  }
  expect(text).toBe(stored);
}

const project = (name: GoldenName): GoldenProject => {
  const found = GOLDEN_PROJECTS.find((candidate) => candidate.name === name);
  if (found === undefined) throw new Error(`no golden project ${name}`);
  return found;
};

const scenarioNumbers = (scenario: ScenarioResult) => ({
  breakEvenMonth: scenario.breakEvenMonth.value,
  fundingNeed: scenario.funding.status === 'ok' ? scenario.funding.need.value.minor : null,
  firstYearProfit: scenario.firstYearOperatingProfit.value.minor,
});

const tornadoNumbers = (run: EngineRun) =>
  run.tornado.rows.map((row) => ({
    variable: row.variable,
    atLow: row.atLow.value.minor,
    atHigh: row.atHigh.value.minor,
    swing: row.swing.value.minor,
  }));

describe.each(GOLDEN_PROJECTS)('golden project $name', (golden) => {
  const run = runGolden(golden);

  it.each(golden.rows)('the hand computation of $id equals the engine', (row) => {
    expect(headlineValue(run, row.id)).toEqual(row.expected);
    expect(sameValue(row.expected, headlineValue(run, row.id))).toBe(true);
  });

  it('is the golden file', () => {
    matchFile(`${GOLDEN_DIR}${golden.name}.json`, serialiseRun(run));
  });

  it('is deterministic: a second run gives the same bytes', () => {
    expect(serialiseRun(runGolden(golden))).toBe(serialiseRun(run));
  });

  it('is run by the version of the engine that wrote the file', () => {
    expect(run.engineVersion).toBe('1.1.0');
  });
});

/*
 * Project 1, a Jordanian subscription service (JOD). Hand computations of the headline numbers are
 * in the rows of golden-projects.ts and asserted above. Here the rest of the run is pinned.
 *
 * Units: 0, 40, 80, 120, 160, 200, then 200 a month. Contribution margin 30 - 6 = 24.
 * Operating costs: 2,000 + 600 = 2,600 a month, and 4,100 from month 4 (the developer).
 * Monthly profit: -2,600, -1,640, -680, -1,220, -260, then +700. Year 1 = -1,500; years 2 and 3 =
 * 700 x 12 = 8,400. Company tax (fixture, 20% of profit): 0, 1,680 (paid in month 28) and 1,680
 * (paid in month 40, after the horizon).
 */
describe('golden project 1: the Jordanian subscription service', () => {
  const run = runGolden(project('jo-service-subscription'));
  const jod = (major: number) => BigInt(major) * 1000n;

  it('has the units, the profit by year and the tax by year computed by hand', () => {
    expect(run.projection.units.monthly.slice(0, 7).map(Number)).toEqual([
      0, 40, 80, 120, 160, 200, 200,
    ]);
    const profits = run.projection.operatingProfit.monthly.slice(0, 7).map((m) => m.minor);
    expect(profits).toEqual([-2600, -1640, -680, -1220, -260, 700, 700].map((n) => jod(n)));
    const tax = run.cash.tax;
    expect(tax.status === 'calculated' && tax.years.map((y) => y.profit.minor)).toEqual([
      jod(-1500),
      jod(8400),
      jod(8400),
    ]);
    expect(tax.status === 'calculated' && tax.years.map((y) => y.total.value.minor)).toEqual([
      0n,
      jod(1680),
      jod(1680),
    ]);
    const flow = run.cash.cashFlow;
    expect(flow.status === 'ok' && flow.taxAfterHorizon?.value.minor).toBe(jod(1680));
    expect(flow.status === 'ok' && flow.cumulative.value[34]?.minor).toBe(jod(220));
    expect(flow.status === 'ok' && flow.cumulative.value[33]?.minor).toBe(jod(-480));
  });

  it('pins the alerts: the runway, the price floor and the set-up costs within the capital range', () => {
    expect(run.alerts.map((alert) => [alert.severity, alert.code])).toEqual([
      ['warning', 'break_even_month_above_runway'],
      ['warning', 'price_below_floor'],
      ['note', 'setup_costs_within_capital_range'],
    ]);
  });

  /*
   * Scenarios. Conservative: at most 0.6 x 200 = 120 subscribers, at a margin of 30 - 6.6 = 23.4,
   * earn 2,808 a month against 4,100 of costs, so no month reaches zero. Optimistic: 1.3 x 160 =
   * 208 subscribers in month 5 at a margin of 30 - 5.7 = 24.3 earn 5,054 against 4,100, while
   * month 4 (156 subscribers, 3,791) does not, so the break-even month is 5.
   */
  it('pins the scenarios', () => {
    expect(scenarioNumbers(run.scenarios.conservative)).toEqual({
      breakEvenMonth: null,
      fundingNeed: jod(70_860),
      firstYearProfit: jod(-27_852),
    });
    expect(scenarioNumbers(run.scenarios.base)).toEqual({
      breakEvenMonth: 6,
      fundingNeed: jod(18_400),
      firstYearProfit: jod(-1_500),
    });
    expect(scenarioNumbers(run.scenarios.optimistic)).toEqual({
      breakEvenMonth: 5,
      fundingNeed: 16_318_400n,
      firstYearProfit: jod(12_162),
    });
  });

  // Year-1 profit with one variable 20% lower and 20% higher: price 24 and 36 -> -12,300 and 9,300;
  // fixed costs 80% and 120% of 44,700 -> 7,440 and -10,440; sales 80% and 120% -> -10,140 and 7,140;
  // VC 4.8 and 7.2 -> 660 and -3,660.
  it('pins the tornado: price, fixed costs, sales, VC', () => {
    expect(tornadoNumbers(run)).toEqual([
      { variable: 'price', atLow: jod(-12_300), atHigh: jod(9_300), swing: jod(21_600) },
      { variable: 'fixed_costs', atLow: jod(7_440), atHigh: jod(-10_440), swing: jod(17_880) },
      { variable: 'sales', atLow: jod(-10_140), atHigh: jod(7_140), swing: jod(17_280) },
      { variable: 'vc', atLow: jod(660), atHigh: jod(-3_660), swing: jod(4_320) },
    ]);
    expect(run.tornado.top?.value).toBe('price');
  });
});

/*
 * Project 2, a Jordanian home e-commerce shop (JOD). Units 150 in the peak months (November and
 * December) and 90 in the other ten, every year. Revenue 6,000 and 3,600; COGS 3,750 and 2,250;
 * operating costs 1,200; profit 1,050 and 150; year 1 = 2 x 1,050 + 10 x 150 = 3,600. Sole
 * proprietor assumed (G1 not sure): 10% fixture tax = 360 a year, paid in month 16, 28 and 40.
 */
describe('golden project 2: the Jordanian home e-commerce shop', () => {
  const run = runGolden(project('jo-home-ecommerce'));
  const jod = (major: number) => BigInt(major) * 1000n;

  it('has the seasonal units computed by hand', () => {
    const units = run.projection.units.monthly.map(Number);
    expect(units.slice(0, 14)).toEqual([
      150, 150, 90, 90, 90, 90, 90, 90, 90, 90, 90, 90, 150, 150,
    ]);
    expect(units.reduce((a, b) => a + b, 0)).toBe(3 * 1200);
  });

  it('shows G1 as an assumption in the tax figures', () => {
    const tax = run.cash.tax;
    expect(tax.status === 'calculated' && tax.legalFormAssumed).toBe(true);
    // The tax is an assumption (the weakest input wins, D-181): G1 is assumed and so is the
    // capacity, and the fixture rule is not verified.
    const first = tax.status === 'calculated' ? tax.years[0]?.total : undefined;
    expect(first).toMatchObject({ source: 'assumption', confidence: 'low', validated: false });
    expect(first?.inputs).toContainEqual({ kind: 'answer', id: 'G1' });
    expect(first?.inputs).toContainEqual({
      kind: 'country_pack_item',
      id: 'fixture.jo.sole.profit_tax',
    });
    expect(run.input.legalForm).toMatchObject({ source: 'assumption', confidence: 'low' });
    expect(run.input.notes).toContainEqual({
      code: 'legal_form_assumed_sole',
      questionId: 'G1',
      state: 'unknown',
    });
  });

  it('pins the alert: the set-up costs above the capital', () => {
    expect(run.alerts.map((alert) => [alert.severity, alert.code])).toEqual([
      ['warning', 'setup_costs_above_capital'],
    ]);
  });

  // COGS of year 1 is 30,000. With 60% imported, a shock s multiplies it by 1 + 0.6 s: 0.88, 0.94,
  // 1.06, 1.12 -> COGS 26,400, 28,200, 31,800, 33,600 and year-1 profit 7,200, 5,400, 1,800, 0.
  // Every shock leaves month 1 (a peak month) profitable. At +20% the cash dips to -13,800 in month 2.
  it('pins the FX test (D6 is 60%)', () => {
    const fx = run.cash.fxTest;
    expect(fx?.share.value).toEqual(makeRate(3n, 5n));
    expect(
      fx?.shocks.map((shock) => ({
        multiplier: shock.cogsMultiplier,
        breakEven: shock.breakEvenMonth.value,
        need: shock.fundingNeed?.value.minor,
        profit: shock.firstYearOperatingProfit.value.minor,
      })),
    ).toEqual([
      { multiplier: makeRate(22n, 25n), breakEven: 1, need: jod(12_000), profit: jod(7_200) },
      { multiplier: makeRate(47n, 50n), breakEven: 1, need: jod(12_450), profit: jod(5_400) },
      { multiplier: makeRate(53n, 50n), breakEven: 1, need: jod(13_350), profit: jod(1_800) },
      { multiplier: makeRate(28n, 25n), breakEven: 1, need: jod(13_800), profit: jod(0) },
    ]);
  });

  it('pins the scenarios', () => {
    expect(scenarioNumbers(run.scenarios.conservative)).toEqual({
      breakEvenMonth: null,
      fundingNeed: jod(29_385),
      firstYearProfit: jod(-7_425),
    });
    expect(scenarioNumbers(run.scenarios.base)).toEqual({
      breakEvenMonth: 1,
      fundingNeed: jod(12_900),
      firstYearProfit: jod(3_600),
    });
    expect(scenarioNumbers(run.scenarios.optimistic)).toEqual({
      breakEvenMonth: 1,
      fundingNeed: 12_862_500n,
      firstYearProfit: jod(10_950),
    });
  });

  // Year 1 at 20% lower and higher: price 32 and 48 -> -6,000 and 13,200; VC 20 and 30 -> 9,600 and
  // -2,400; sales -> 0 and 7,200; fixed costs 11,520 and 17,280 -> 6,480 and 720.
  it('pins the tornado: price, VC, sales, fixed costs', () => {
    expect(tornadoNumbers(run)).toEqual([
      { variable: 'price', atLow: jod(-6_000), atHigh: jod(13_200), swing: jod(19_200) },
      { variable: 'vc', atLow: jod(9_600), atHigh: jod(-2_400), swing: jod(12_000) },
      { variable: 'sales', atLow: jod(0), atHigh: jod(7_200), swing: jod(7_200) },
      { variable: 'fixed_costs', atLow: jod(6_480), atHigh: jod(720), swing: jod(5_760) },
    ]);
  });

  it('shows the instalments of month 1 to 4: 2,000, 4,000, 5,200 and 4,400 received', () => {
    const flow = run.cash.cashFlow;
    expect(flow.status === 'ok' && flow.receipts.monthly.slice(0, 5).map((m) => m.minor)).toEqual(
      [2000, 4000, 5200, 4400, 3600].map((n) => jod(n)),
    );
    expect(flow.status === 'ok' && flow.receiptsAfterHorizon.value.minor).toBe(jod(3600));
    expect(flow.status === 'ok' && flow.taxAfterHorizon?.value.minor).toBe(jod(360));
  });
});

/*
 * Every F7 option on the e-commerce shop (D-187): the hand computations are in the rows of
 * golden-projects.ts. With cash the cumulative cash first reaches zero or more in month 27 (+90) and a tax pushes it
 * below again in month 28, so the payback is month 29 (D-215).
 */
describe('the four payment options on the e-commerce shop', () => {
  const shop = project('jo-home-ecommerce');

  it.each(shop.paymentVariants)('$option', (variant) => {
    const run = runWithPayment(shop, variant.option);
    const flow = run.cash.cashFlow;
    if (flow.status !== 'ok') throw new Error('expected a cash flow');
    expect(flow.fundingNeed.value.minor).toBe(variant.fundingNeed);
    expect(flow.lowest.value.month).toBe(variant.fundingMonth);
    expect(flow.payback.value).toBe(variant.payback);
    expect(run.input.paymentOption?.value).toBe(variant.option);
  });

  it('covers cash, credit, instalments and deposit', () => {
    expect(shop.paymentVariants.map((variant) => variant.option)).toEqual([
      'cash',
      'credit',
      'instalments',
      'deposit',
    ]);
  });

  it('keeps the golden option (instalments) the same as the variant', () => {
    expect(serialiseRun(runWithPayment(shop, 'instalments'))).toBe(serialiseRun(runGolden(shop)));
  });

  it('first reaches zero or more in month 27 with cash, and falls below it again in month 28', () => {
    const run = runWithPayment(shop, 'cash');
    const flow = run.cash.cashFlow;
    expect(flow.status === 'ok' && flow.cumulative.value[27]?.minor).toBe(90_000n);
    expect(flow.status === 'ok' && flow.cumulative.value[28]?.minor).toBe(-120_000n);
    expect(flow.status === 'ok' && flow.cumulative.value[29]?.minor).toBe(30_000n);
  });
});

/*
 * Project 3, an Algerian auto-entrepreneur (DZD). Units 0, 20, 40, 60, 80, 100, then 100 a month;
 * 100% growth a year, so that year 2 is 1,781 units and year 3 is 3,563 (the monthly levels
 * 100 x 2^(k/12) and 200 x 2^(k/12), each rounded to a unit; the engine's 18-digit root and an
 * exact decimal calculation outside it give the same units). The fixture levy is SPEC section 7:
 * 0.5% of turnover, minimum 10,000, ceiling 5,000,000. Turnover: 1,800,000, 3,562,000, 7,126,000.
 */
describe('golden project 3: the Algerian auto-entrepreneur', () => {
  const run = runGolden(project('dz-auto-entrepreneur'));
  const dzd = (major: number) => BigInt(major) * 100n;

  it('has the doubling units computed by hand', () => {
    const units = run.projection.units.monthly.map(Number);
    expect(units.slice(12, 24)).toEqual([
      106, 112, 119, 126, 133, 141, 150, 159, 168, 178, 189, 200,
    ]);
    expect(units.slice(24, 36)).toEqual([
      212, 224, 238, 252, 267, 283, 300, 317, 336, 356, 378, 400,
    ]);
  });

  it('applies the minimum in year 1 and the rate in years 2 and 3', () => {
    const tax = run.cash.tax;
    if (tax.status !== 'calculated') throw new Error('expected a tax');
    // 0.5% of 1,800,000 = 9,000 (minimum 10,000 applies); 0.5% of 3,562,000 = 17,810; of 7,126,000 = 35,630.
    expect(tax.years.map((year) => year.total.value.minor)).toEqual([
      dzd(10_000),
      dzd(17_810),
      dzd(35_630),
    ]);
    expect(tax.years.map((year) => year.charges[0]?.minimumApplied)).toEqual([true, false, false]);
    expect(tax.years.map((year) => year.charges[0]?.paymentMonth)).toEqual([15, 27, 39]);
    const flow = run.cash.cashFlow;
    // The tax of year 3 is paid in month 39, after the horizon.
    expect(flow.status === 'ok' && flow.taxAfterHorizon?.value.minor).toBe(dzd(35_630));
    // The deposit's second half of the last month arrives after the horizon: 400 x 2,000 / 2.
    expect(flow.status === 'ok' && flow.receiptsAfterHorizon.value.minor).toBe(dzd(400_000));
  });

  it('raises the ceiling alert in year 3 only', () => {
    const ceilings = run.alerts.filter((alert) => alert.code === 'turnover_above_regime_ceiling');
    expect(ceilings).toHaveLength(1);
    const [ceiling] = ceilings;
    expect(ceiling).toMatchObject({
      origin: 'tax',
      severity: 'warning',
      year: 3,
      regime: 'fixture_auto_entrepreneur',
      measured: { kind: 'money', money: makeMoney(dzd(7_126_000), 'DZD') },
      limit: { kind: 'money', money: makeMoney(dzd(5_000_000), 'DZD') },
    });
    expect(run.alerts.map((alert) => [alert.severity, alert.code])).toEqual([
      ['warning', 'turnover_above_regime_ceiling'],
      ['note', 'setup_costs_within_capital_range'],
    ]);
  });

  it('marks the tax as unverified fixture figures', () => {
    const tax = run.cash.tax;
    if (tax.status !== 'calculated') throw new Error('expected a tax');
    const first = tax.years[0]?.total;
    // An assumption, because the units are (D7 unknown, E7 missing): the weakest input wins (D-181).
    expect(first).toMatchObject({ source: 'assumption', confidence: 'low', validated: false });
    expect(first?.inputs).toContainEqual({
      kind: 'country_pack_item',
      id: 'fixture.dz.sole.turnover_levy',
    });
  });

  it('pins the scenarios', () => {
    expect(scenarioNumbers(run.scenarios.conservative)).toEqual({
      breakEvenMonth: 8,
      fundingNeed: dzd(613_600),
      firstYearProfit: dzd(-196_800),
    });
    expect(scenarioNumbers(run.scenarios.base)).toEqual({
      breakEvenMonth: 4,
      fundingNeed: dzd(418_000),
      firstYearProfit: dzd(480_000),
    });
    expect(scenarioNumbers(run.scenarios.optimistic)).toEqual({
      breakEvenMonth: 3,
      fundingNeed: dzd(405_280),
      firstYearProfit: dzd(850_800),
    });
  });

  // Year 1 at 20% lower and higher: price 1,600 and 2,400 -> 120,000 and 840,000; sales 80% and
  // 120% -> 264,000 and 696,000; VC 640 and 960 -> 624,000 and 336,000; fixed costs 480,000 and
  // 720,000 -> 600,000 and 360,000.
  it('pins the tornado: price, sales, VC, fixed costs', () => {
    expect(tornadoNumbers(run)).toEqual([
      { variable: 'price', atLow: dzd(120_000), atHigh: dzd(840_000), swing: dzd(720_000) },
      { variable: 'sales', atLow: dzd(264_000), atHigh: dzd(696_000), swing: dzd(432_000) },
      { variable: 'vc', atLow: dzd(624_000), atHigh: dzd(336_000), swing: dzd(288_000) },
      { variable: 'fixed_costs', atLow: dzd(600_000), atHigh: dzd(360_000), swing: dzd(240_000) },
    ]);
  });
});

describe('the golden fixtures as a set', () => {
  it('use every F7 option and both kinds of payback', () => {
    const options = new Set(
      GOLDEN_PROJECTS.flatMap((golden) => [
        golden.answers.F7 && 'value' in golden.answers.F7 ? golden.answers.F7.value : null,
        ...golden.paymentVariants.map((variant) => variant.option),
      ]),
    );
    expect([...options].sort()).toEqual(['cash', 'credit', 'deposit', 'instalments']);
    const paybacks = GOLDEN_PROJECTS.map((golden) => {
      const flow = runGolden(golden).cash.cashFlow;
      return flow.status === 'ok' ? flow.payback.value : undefined;
    });
    expect(paybacks).toEqual([34, null, 11]);
  });

  it('use only artificial, unverified tax rules that say so', () => {
    for (const golden of GOLDEN_PROJECTS) {
      expect(golden.tax.rules.length).toBeGreaterThan(0);
      for (const rule of golden.tax.rules) {
        expect(rule.sourceUrl).toBe('https://example.invalid/fixture');
        expect(rule.status).toBe('unverified');
        expect(rule.lastVerified).toBeNull();
        expect(`${rule.id} ${rule.regime} ${rule.levy}`).toMatch(/fixture/);
      }
    }
  });

  it('compares values of the same kind only', () => {
    const money: Expected = { kind: 'money', minor: 5n };
    expect(sameValue(money, { kind: 'money', minor: 5n })).toBe(true);
    expect(sameValue(money, { kind: 'money', minor: 6n })).toBe(false);
    expect(sameValue(money, { kind: 'units', units: 5n })).toBe(false);
    expect(sameValue({ kind: 'units', units: 5n }, { kind: 'units', units: 5n })).toBe(true);
    expect(sameValue({ kind: 'units', units: 5n }, money)).toBe(false);
    expect(sameValue({ kind: 'month', month: null }, { kind: 'month', month: null })).toBe(true);
    expect(sameValue({ kind: 'month', month: 3 }, { kind: 'month', month: null })).toBe(false);
    expect(sameValue({ kind: 'month', month: 3 }, money)).toBe(false);
    const half = makeRate(1n, 2n);
    expect(sameValue({ kind: 'rate', rate: half }, { kind: 'rate', rate: makeRate(2n, 4n) })).toBe(
      true,
    );
    expect(sameValue({ kind: 'rate', rate: half }, { kind: 'rate', rate: makeRate(1n, 3n) })).toBe(
      false,
    );
    expect(sameValue({ kind: 'rate', rate: half }, money)).toBe(false);
  });
});

describe('the helpers of the golden fixtures', () => {
  const shop = project('jo-home-ecommerce');
  const without = (...ids: string[]) =>
    Object.fromEntries(Object.entries(shop.answers).filter(([id]) => !ids.includes(id)));

  it('refuse a project the engine cannot calculate', () => {
    expect(() => runGolden({ ...shop, answers: without('F3') })).toThrow(/not calculable/);
  });

  it('refuse a figure the run does not have', () => {
    const noSetup = runGolden({ ...shop, answers: without('F5') });
    expect(() => headlineValue(noSetup, 'funding_need')).toThrow(/cash flow/);
    const noRules = runGolden({ ...shop, tax: { rules: [] } });
    expect(() => headlineValue(noRules, 'tax_y1')).toThrow(/tax was not calculated/);
    expect(() => headlineValue(runGolden(shop), 'ltv')).toThrow(/no LTV/);
    const loss = runGolden({
      ...shop,
      answers: {
        ...shop.answers,
        F1: { status: 'answered', value: { amount: 20, currency: 'JOD' } },
      },
    });
    expect(() => headlineValue(loss, 'cm')).toThrow(/T8 is blocked/);
  });
});

/*
 * The owner review page (D-223) is rendered from the same runs and compared like a golden file:
 * a changed formula changes the numbers on the page, and the diff shows it.
 */
describe('the owner review page', () => {
  it('is docs/engine-review/index.html', () => {
    matchFile(REVIEW_PAGE, renderReviewPage(goldenReviewEntries()));
  });
});
