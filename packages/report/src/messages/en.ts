import { inl } from '../model/inline';
import type { ReportMessages } from './types';

/*
 * The report in English (D-270). A draft for the owner's review (OPEN-QUESTIONS #98). No digit
 * appears in any message: every number enters through a slot. The Arabic report puts the English
 * term in parentheses on first use; the English report needs no such gloss.
 */
export const en: ReportMessages = {
  reportKind: 'Business model report',
  sections: {
    cover: 'Cover',
    executive_summary: 'Executive summary',
    project_card: 'Project card',
    canvases: 'Business model canvases',
    pricing_unit_economics: 'Pricing and unit economics',
    projection: 'Financial projection',
    scenarios_sensitivity: 'Scenarios and sensitivity',
    legal_path_financing: 'Legal path and financing',
    validation_plan: 'Validation plan',
    appendix_assumptions: 'Appendix A: assumptions register',
    appendix_sources: 'Appendix B: sources',
    appendix_disclaimer: 'Appendix C: disclaimer',
    top_risks: 'Top three risks',
    break_even: 'Break-even estimate',
  },
  verdictWords: { go: 'Go', revise: 'Revise', stop: 'Stop' },
  stopSentence: 'Not viable in its current form',
  terms: {
    break_even: { name: 'Break-even', english: null },
    payback: { name: 'Payback period', english: null },
    contribution_margin: { name: 'Contribution margin', english: null },
    ltv: { name: 'Customer lifetime value (LTV)', english: null },
    cac: { name: 'Customer acquisition cost (CAC)', english: null },
    price_floor: { name: 'Price floor', english: null },
    sensitivity: { name: 'Sensitivity analysis', english: null },
  },

  words: {
    source: { user: 'From your answers', assumption: 'Assumption', external: 'External source' },
    confidence: { high: 'High', medium: 'Medium', low: 'Low', missing: 'Missing' },
    validated: 'Confirmed',
    unvalidated: 'Not confirmed',
    yes: 'Yes',
    no: 'No',
    notCalculated: 'Not calculated',
    perMonth: 'per month',
    dash: '—',
    listSeparator: '; ',
  },
  lowConfidence: 'This number is an assumption. Test it before you build a decision on it.',
  verifyOfficialSource: 'Check the official source',
  adviserLine: 'We recommend consulting a tax adviser in your country before any decision.',

  month: ({ n }) => inl`Month ${n}`,
  months: ({ count, n }) => {
    if (count === 1) return ['one month'];
    if (count === 2) return ['two months'];
    return inl`${n} months`;
  },
  units: ({ count, n }) => {
    if (count === 1) return ['one unit'];
    if (count === 2) return ['two units'];
    return inl`${n} units`;
  },
  changes: ({ count, n }) => {
    if (count === 1) return ['one change'];
    if (count === 2) return ['two changes'];
    return inl`${n} changes`;
  },
  within: ({ months }) => inl`within ${months}`,
  noBreakEvenWithin: ({ months }) => inl`no break-even within ${months}`,
  noPaybackWithin: ({ months }) => inl`capital not recovered within ${months}`,
  quarter: ({ n }) => inl`Quarter ${n}`,
  yearLabel: ({ n }) => inl`Year ${n}`,
  yearTotal: 'Year total',
  total: 'Total',

  cover: {
    promise:
      'Every number in this report is calculated by the engine with fixed formulas and carries its source and its level of confidence. No language model writes any number.',
    facts: {
      project: 'Project',
      country: 'Country',
      currency: 'Report currency',
      issuedOn: 'Issued on',
      engineVersion: 'Engine version',
      completeness: 'Answers completed',
      confidence: 'Overall confidence',
    },
    currencyValue: ({ name, code }) => inl`${name} (${code})`,
    confidenceValue: ({ level, sound, total }) =>
      inl`${level} (${sound} of ${total} key answers are sound)`,
  },

  executive: {
    opening: {
      investor:
        'This report is addressed to a prospective investor, so it opens with what matters most to one: first-year profit, then the break-even month, then the funding you need.',
      bank: 'This report is addressed to a bank, so it opens with what matters most to one: the funding need, then the break-even month, then first-year profit.',
      grant:
        'This report is addressed to a grant body, so it opens with the break-even month, then the funding need, then first-year profit.',
      course:
        'This report is a course assignment, so it shows the verdict and the three numbers in their usual order to make the method easy to explain.',
      self: 'This report is for you, so it shows the verdict, then the three numbers and the main risks.',
    },
    reason: {
      go: ({ passed, evaluated, score, line }) =>
        inl`${passed} of ${evaluated} feasibility criteria pass (${score}), which reaches or exceeds the Go line (${line}); no criterion blocks, and your confidence in the key figures is sufficient.`,
      noBlocker: 'No criterion blocks.',
      blockers: ({ count }) =>
        inl`Blocking conditions hold (${count}); they are listed in the risks below.`,
      score: ({ passed, evaluated, score, line }) =>
        inl`${passed} of ${evaluated} feasibility criteria pass (${score}); the Go line is ${line}.`,
      changesReach: ({ changes }) =>
        inl`We found ${changes} to your numbers, and applying that takes the project to Go.`,
      changesImprove: ({ changes }) =>
        inl`We found ${changes} to your numbers, and applying that improves the result but does not take the project to Go on its own.`,
      goNeedsConfidence:
        'The project cannot reach Go while your confidence in the key figures is low.',
      notProbability:
        'The score is not a probability of success; it is the share of criteria that pass.',
    },
    holdBacks: {
      score_below_line: ({ passed, evaluated, score, line }) =>
        inl`${passed} of ${evaluated} feasibility criteria pass (${score}), which is below the Go line (${line}).`,
      no_score: () => ['No feasibility criterion could be evaluated with the answers given.'],
      confidence_low: ({ sound, total }) =>
        inl`Your overall confidence is low: ${sound} of ${total} key answers are sound.`,
    },
    meterCaption: ({ passed, evaluated, line }) =>
      inl`Feasibility criteria met: ${passed} of ${evaluated}. The Go line is at ${line}.`,
    keyNumbers: {
      fundingNeed: 'Funding need',
      breakEven: 'Break-even month',
      firstYearProfit: 'Year-one operating profit',
      fundingNeedCaption: ({ month }) => inl`Lowest cash balance, in ${month}`,
      fundingNeedNone: 'Set-up costs are needed to calculate it',
      breakEvenCaption: ({ term }) => inl`${term}: the first month income covers costs`,
      breakEvenNone: 'The unit margin is not positive, so there is no break-even',
      firstYearProfitCaption: 'Operating profit before tax',
    },
    risksTitle: 'Main risks',
    blocksCaption: 'Criteria not met',
    blocksColumns: { criterion: 'Criterion', measured: 'Measured', limit: 'Limit' },
    blocksNote: ({ evaluated, total }) =>
      inl`${evaluated} of ${total} criteria were evaluated; a criterion that lacks answers is not counted.`,
    criteria: {
      margin_positive: 'The unit margin is positive',
      break_even_within_window: 'Break-even within the feasibility window',
      break_even_within_target: 'Break-even within the longest wait you accepted',
      break_even_within_runway: 'Break-even within the time you can go without income',
      funding_within_capital: 'Funding need within your largest available capital',
      setup_within_capital: 'Set-up costs within your largest available capital',
      price_above_floor: 'The price is not below the lowest price that covers costs',
      ltv_cac_at_minimum: 'Customer value to acquisition cost is not below the minimum',
      conservative_break_even: 'Break-even in the conservative scenario',
      payback_within_window: 'Capital recovered within the feasibility window',
      break_even_units_within_capacity: 'Break-even units within maximum capacity',
    },
    changesCaption: {
      stop: 'Calculated changes to your numbers that change the verdict',
      revise: 'Changes to your numbers that bring the project closer to Go',
    },
    changesColumns: {
      change: 'Change',
      now: 'Now',
      suggested: 'Suggested',
      delta: 'Change',
      result: 'Result',
    },
    changeResult: ({ verdict, passed, evaluated }) => inl`${verdict} · ${passed} of ${evaluated}`,
    changeLevers: {
      price: { up: 'Raise the price', down: 'Lower the price' },
      variable_cost: { up: 'Raise the variable cost', down: 'Lower the variable cost' },
      fixed_costs: { up: 'Raise the fixed costs', down: 'Lower the fixed costs' },
      sales: { up: 'Raise sales', down: 'Lower sales' },
      setup_costs: { up: 'Raise the set-up costs', down: 'Lower the set-up costs' },
    },
    leverBasis: {
      price: 'Against what you entered',
      variable_cost: 'Against what you entered',
      fixed_costs: 'Relative to your current estimate',
      sales: 'Relative to your current forecast',
      setup_costs: 'Against what you entered',
    },
    leverNames: {
      price: 'Price',
      variable_cost: 'Variable cost',
      fixed_costs: 'Fixed costs',
      sales: 'Sales',
      setup_costs: 'Set-up costs',
    },
    premiumNote: ({ ceiling }) =>
      inl`Above the highest competitor (${ceiling}): your offer needs a measurable difference.`,
    premiumNoteNoCeiling:
      'A price above the competitors’ range: your offer needs a measurable difference.',
    rethinkTitle: 'Rethink these numbers: no single value is enough on its own',
    rethinkItem: ({ lever, swing }) =>
      inl`${lever}: first-year profit moves by ${swing} across the tested range.`,
    changesUnavailable: 'The suggested changes have not been calculated for this project yet.',
    confidenceLine: ({ level, sound, total }) =>
      inl`Overall confidence in your answers is ${level} (${sound} of ${total} key answers are sound).`,
    beforeTax: 'All figures are before tax, because tax was not calculated.',
  },

  risks: {
    none: 'No major risk is visible from your current answers.',
    figures: {
      F1: 'the selling price',
      F3: 'the variable cost per unit',
      F4: 'the fixed costs',
      F5: 'the set-up costs',
      F6: 'the sales forecast',
    },
    pivotalMissing: ({ figure }) =>
      inl`You have not answered about ${figure} yet, and the calculation is incomplete without it.`,
    pivotalAssumed: ({ figure }) =>
      inl`${figure} is an unconfirmed assumption: test it before you build a decision on it.`,
    worry: ({ worry }) => inl`Your own worry: “${worry}”.`,
    blockers: {
      margin_not_positive: ({ margin }) =>
        inl`The unit margin (${margin}) is not positive: every sale loses money, so there is no break-even.`,
      no_break_even_in_window: ({ window }) =>
        inl`No break-even within ${window} in the base case.`,
      funding_need_above_capital_multiple: ({ need, capital, multiple }) =>
        inl`The funding need (${need}) exceeds your largest available capital (${capital}) by more than the multiple ${multiple}, and you named no outside funding source.`,
    },
  },

  alerts: {
    cm_not_positive: ({ measured, limit }) =>
      inl`The unit margin (${measured}) is not above the limit (${limit}).`,
    break_even_units_above_capacity: ({ measured, limit }) =>
      inl`Break-even units (${measured}) exceed your maximum monthly capacity (${limit}).`,
    break_even_month_above_target: ({ measured, limit }) =>
      inl`Break-even (${measured}) comes after the longest wait you accepted (${limit}).`,
    break_even_month_above_runway: ({ measured, limit }) =>
      inl`Break-even (${measured}) comes after the time you can go without income (${limit}).`,
    setup_costs_above_capital: ({ measured, limit }) =>
      inl`Set-up costs (${measured}) exceed your largest available capital (${limit}).`,
    setup_costs_within_capital_range: ({ measured, limit, lowerLimit }) =>
      inl`Set-up costs (${measured}) are above your smallest available capital (${lowerLimit}) and below your largest (${limit}).`,
    price_below_floor: ({ measured, limit }) =>
      inl`The price (${measured}) is below the lowest price that covers your costs (${limit}).`,
    ltv_to_cac_below_minimum: ({ measured, limit }) =>
      inl`Customer value to acquisition cost (${measured}) is below the minimum (${limit}).`,
    turnover_above_regime_ceiling: ({ measured, limit, year, regime }) =>
      inl`Your revenue in year ${year} (${measured}) exceeds the ceiling of the ${regime} tax regime (${limit}).`,
    turnover_above_vat_threshold: ({ measured, limit, year }) =>
      inl`Your revenue in year ${year} (${measured}) exceeds the sales-tax registration threshold (${limit}).`,
    tax_regime_not_calculated: () => [
      'Tax was not calculated for lack of a documented rule, so the figures are before tax.',
    ],
  },
  taxGaps: {
    no_rule: () => [
      'No documented, verified tax rule exists for this case, so we do not calculate a number of our own.',
    ],
    ambiguous_regime: ({ regimes }) =>
      inl`More than one tax regime applies (${regimes}) and we do not choose between them for you, so we do not calculate a number of our own.`,
    rule_other_currency: ({ currency }) =>
      inl`The tax rule available is in another currency (${currency}) and we do not convert currencies, so we do not calculate a number of our own.`,
  },

  breakEven: {
    estimate: ({ term, month, revenue, units }) =>
      inl`By our estimate your project reaches ${term} in ${month}, at ${units} a month and monthly revenue of ${revenue}.`,
    notReached: ({ term, horizon }) =>
      inl`The project does not reach ${term} within ${horizon} on the current numbers.`,
    blocked: ({ term, margin }) =>
      inl`There is no ${term}: the unit margin (${margin}) is not positive.`,
    notEnough: ({ term }) => inl`Your answers are not enough yet to estimate ${term}.`,
    missingIntro: 'Still missing',
    caveat:
      'An estimate from your numbers and the engine’s assumptions, not a promise of an outcome.',
  },
  notCalculable: {
    invalid_project: () => ['The project data (country, currency or date) is not valid.'],
    missing_answer: ({ question }) => inl`Missing: ${question}.`,
    unknown_answer: ({ question }) =>
      inl`You answered “I don’t know” about ${question}, and a real value is needed.`,
    currency_mismatch: ({ question, currency }) =>
      inl`The currency of ${question} (${currency}) differs from the report currency, and we do not convert currencies.`,
    invalid_value: ({ question }) => inl`The value of ${question} is not valid.`,
    no_price: () => [
      'There is no price to calculate from: enter a selling price or competitor prices.',
    ],
  },

  card: {
    rows: {
      team: 'Team',
      idea: 'The idea',
      customerType: 'Who pays',
      customerProfile: 'First customer',
      location: 'Location',
      workplace: 'Where you work',
      sector: 'Sector',
      projectType: 'Project type',
      pricingModel: 'Pricing model',
      price: 'Selling price',
      capital: 'Available capital',
      goal: 'Goal of the project',
    },
    empty: 'You have not yet answered the questions that identify the project.',
    location: ({ city, country }) => inl`${city}, ${country}`,
    moneyRange: ({ min, max }) => inl`from ${min} to ${max}`,
  },

  canvases: {
    intro:
      'Each cell shows your own words as you wrote them, with their source and level of confidence; the platform writes no text for you.',
    names: { business_model: 'Business Model Canvas', lean: 'Lean Canvas' },
    blocks: {
      customerSegments: 'Customer segments',
      valuePropositions: 'Value propositions',
      channels: 'Channels',
      customerRelationships: 'Customer relationships',
      revenueStreams: 'Revenue streams',
      keyResources: 'Key resources',
      keyActivities: 'Key activities',
      keyPartners: 'Key partners',
      costStructure: 'Cost structure',
      problem: 'Problem',
      solution: 'Solution',
      keyMetrics: 'Key metrics',
      uniqueValueProposition: 'Unique value proposition',
      unfairAdvantage: 'Unfair advantage',
    },
    empty: {
      unanswered: 'You have not yet answered the question behind this cell.',
      unknown: 'You answered “I don’t know” to the question behind this cell.',
      empty: 'You answered the question but listed nothing.',
      no_question: 'The diagnostic has no question that fills this cell yet.',
    },
    totals: {
      fixedMonthly: 'Total fixed costs per month',
      variableUnit: 'Variable cost per unit',
      setup: 'Total set-up costs',
    },
  },

  pricing: {
    unitCaption: 'Unit economics and break-even',
    columns: { item: 'Item', value: 'Value' },
    rows: {
      price: 'Selling price per unit',
      variableCost: 'Variable cost per unit',
      fixedEntered: 'Fixed costs you entered, per month',
      margin: ({ term }) => inl`${term} per unit`,
      marginRate: 'Margin rate',
      fixedTotal: 'Total fixed costs per month as the engine counts them',
      breakEvenUnits: 'Break-even units per month',
      breakEvenRevenue: 'Break-even revenue per month',
      breakEvenMonth: ({ term }) => inl`${term} month`,
    },
    blocked: ({ margin }) =>
      inl`The unit margin (${margin}) is not positive: break-even cannot be calculated, and you need to raise the price or lower the variable cost first.`,
    capacityUnlimited:
      'You gave no maximum monthly capacity, so break-even units are not compared with one.',
    capacityWithin: ({ units, capacity }) =>
      inl`Break-even units (${units}) are within your maximum monthly capacity (${capacity}).`,
    capacityAbove: ({ units, capacity }) =>
      inl`Break-even units (${units}) exceed your maximum monthly capacity (${capacity}).`,
    subscriptionCaption: 'Subscription measures',
    subscriptionRows: {
      arpu: 'Average revenue per subscriber per month',
      churn: 'Monthly churn',
      ltv: ({ term }) => inl`${term}`,
      newCustomers: 'New subscribers per month',
      cac: ({ term }) => inl`${term}`,
      ltvToCac: 'Customer value to acquisition cost',
    },
    subscriptionGaps: {
      churn_unset: 'You gave no churn, so customer value is not calculated.',
      churn_zero: 'Churn is zero, so no finite customer value is calculated.',
      no_new_customers:
        'There are no new subscribers in the projection, so acquisition cost is not calculated.',
      no_marketing: 'There is no marketing budget, so acquisition cost is not calculated.',
    },
    marketCaption: 'Price positions in the market',
    marketRows: {
      floor: ({ term }) => inl`${term}`,
      bandMin: 'Lowest competitor price',
      bandMedian: 'Median competitor price',
      bandMax: 'Highest competitor price',
      penetration: 'Penetration price',
      market: 'Market price',
      premium: 'Premium price',
    },
    marketGaps: {
      no_units:
        'No units are sold in year one, so the lowest price that covers costs is not calculated.',
      no_competitor_prices:
        'There are no competitor prices, so the market range is not calculated.',
    },
    premiumAllowed:
      'Your answer on why a customer would choose you passed the measurable-difference check, so a premium price is part of the comparison.',
    premiumNotAllowed:
      'A premium price needs a measurable difference in your offer, and your answer does not show one yet.',
  },

  projection: {
    intro: ({ timing }) =>
      inl`Revenue is collected ${timing}. Figures are before tax unless stated otherwise.`,
    yearOneCaption: 'Year one, month by month',
    laterYearCaption: ({ year }) => inl`Year ${year}: by quarter (each quarter is three months)`,
    rows: {
      units: 'Units sold',
      revenue: 'Revenue',
      cogs: 'Cost of sales',
      grossProfit: 'Gross profit',
      operatingCosts: 'Operating costs',
      operatingProfit: 'Operating profit',
      netCash: 'Net cash',
      cumulativeCash: 'Cumulative cash balance',
      cumulativeCashBeforeTax: 'Cumulative cash balance before tax',
    },
    monthHeader: 'Month',
    itemHeader: 'Item',
    startsFrom: ({ setup }) =>
      inl`The cash balance starts from ${setup}, which is the set-up costs.`,
    legendLowest: ({ month }) =>
      inl`The lowest cash balance is in ${month}; it is the funding need.`,
    legendBreakEven: ({ term, month }) =>
      inl`${term}: the first month operations make a profit, which is ${month}.`,
    paybackLine: ({ term, month }) => inl`${term}: the capital you spent is recovered in ${month}.`,
    paybackNone: ({ term, horizon }) =>
      inl`${term}: the capital you spent is not recovered within ${horizon} on the current numbers.`,
    cashNotCalculated: 'Cash flow was not calculated because you did not give the set-up costs.',
    timingWords: {
      cash: 'in cash in the same month',
      credit: 'on credit, after the month of sale',
      instalments: 'in instalments over consecutive months',
      deposit: 'as a deposit with the rest later',
      assumed: 'in cash in the same month, assumed because you did not say how customers pay',
    },
    taxNotIncluded: 'Tax is not included in these figures.',
  },

  scenarios: {
    caption: 'The three scenarios',
    names: { conservative: 'Conservative', base: 'Base', optimistic: 'Optimistic' },
    rows: {
      assumptions: 'Assumptions',
      breakEvenMonth: 'Break-even month',
      fundingNeed: 'Funding need',
      firstYearProfit: 'Year-one operating profit',
    },
    baseAssumptions: 'Your numbers as entered',
    assumptions: ({ sales, cost }) => inl`Sales × ${sales}, variable cost × ${cost}`,
    assumptionsDelay: ({ sales, cost, delay }) =>
      inl`Sales × ${sales}, variable cost × ${cost}, launch delayed by ${delay}`,
    fundingNotCalculated: 'Set-up costs are needed',
    tornadoCaption: ({ term, change }) =>
      inl`${term}: the four numbers ranked by their effect on year-one profit, each moved ${change} up and down`,
    tornadoColumns: {
      variable: 'Number',
      low: 'Year-one profit at the low end',
      high: 'Year-one profit at the high end',
      swing: 'Swing',
    },
    variables: {
      price: 'Price',
      vc: 'Variable cost',
      sales: 'Sales',
      fixed_costs: 'Fixed costs',
    },
    tornadoNote:
      'The number at the top of the table is the one most worth testing before you spend.',
  },

  legal: {
    noPack: ({ country }) =>
      inl`There is no verified data pack for ${country} yet, so we show no registration path or legal values for it; check with the official bodies in your country.`,
    guideTitle: 'Registration and licensing steps',
    roles: {
      path: 'Main path',
      condition: 'Condition',
      alternative: 'Alternative path',
      comparison: 'For comparison',
      sector: 'For your sector',
      home: 'Working from home',
      confirm: 'Confirm with the official body',
      note: 'Note',
      always: 'Always',
    },
    missingItems: ({ count }) =>
      inl`Some pack items (${count}) are not available yet, so these steps do not cover everything that may apply to you.`,
    taxCalculated: ({ regime }) =>
      inl`Tax was calculated in the projection under the “${regime}” regime.`,
    taxCaption: 'Tax calculated for each year',
    taxColumns: { year: 'Year', turnover: 'Revenue', profit: 'Operating profit', tax: 'Tax' },
    noOfficialLink:
      'The data for this country holds no official link for the tax authority yet, and we will not put one of our own.',
    financingTitle: 'Financing',
    fundingVsCapitalWithin: ({ need, min, max }) =>
      inl`The funding need (${need}) does not exceed the largest capital you named (${max}); your smallest is ${min}.`,
    fundingVsCapitalAbove: ({ need, max }) =>
      inl`The funding need (${need}) is above the largest capital you named (${max}): the difference needs an outside source or a change in your numbers.`,
    fundingNoCapital: ({ need }) =>
      inl`The funding need is ${need}, and you gave no available capital to compare it with.`,
    fundingNotCalculated:
      'The funding need was not calculated because you did not give the set-up costs.',
    outsideSources: ({ sources }) => inl`Outside funding sources you chose: ${sources}.`,
    noOutsideSources: 'You chose no outside funding source.',
    shariaYes:
      'You prefer Sharia-compliant financing, so ask the provider about the contract form and its Sharia supervision before any commitment.',
  },

  validation: {
    intro: ({ days }) =>
      inl`A test plan of ${days} days: test the most important assumptions before you spend on them, ranked by how much each moves your profit and how confident you are in it.`,
    worryTitle: 'Your own worry',
    worryQuote: ({ worry }) => inl`“${worry}”`,
    entryTitle: ({ n }) => inl`Test ${n}`,
    why: {
      price: ({ value, change, swing, confidence }) =>
        inl`Your price is ${value}. Changing it by ${change} moves year-one profit by ${swing}. Your confidence in it is ${confidence}.`,
      vc: ({ value, change, swing, confidence }) =>
        inl`Your variable cost per unit is ${value}. Changing it by ${change} moves year-one profit by ${swing}. Your confidence in it is ${confidence}.`,
      sales: ({ value, change, swing, confidence }) =>
        inl`You forecast ${value} units a month in month twelve. Changing that by ${change} moves year-one profit by ${swing}. Your confidence in it is ${confidence}.`,
      fixed_costs: ({ value, change, swing, confidence }) =>
        inl`Your fixed costs are ${value} a month. Changing them by ${change} moves year-one profit by ${swing}. Your confidence in them is ${confidence}.`,
    },
    labels: {
      why: 'Why',
      test: 'The test',
      success: 'Success line',
      fallback: 'If it fails',
      cost: 'Cost',
    },
    successDefault:
      'This is the protocol’s default description; you set the number you will accept before you start.',
    costClasses: {
      time: 'Your time',
      small_cash: 'A small amount of cash',
      supplier_quote: 'Supplier quotes',
    },
    codes: {
      'price.willingness_to_pay':
        'Offer the product or service at this price to prospective customers and record who actually agrees to pay.',
      'price.accepting_share':
        'The share of those you ask who actually agree to pay, not those who merely like the offer.',
      'price.test_second_price': 'Try a second price on a new group.',
      'variable_cost.supplier_quotes':
        'Ask suppliers for written quotes for each item of the variable cost.',
      'variable_cost.quotes_within_estimate':
        'The quotes do not exceed your estimate of the variable cost.',
      'variable_cost.second_supplier': 'Ask a second supplier for a quote, or change the material.',
      'sales.paid_preorders': 'Collect paid pre-orders from real customers.',
      'sales.preorders_against_month_one':
        'The number of pre-orders against your forecast for month one.',
      'sales.revise_forecast': 'Revise the sales forecast and run the numbers again.',
      'fixed_costs.written_quotes': 'Ask for a written quote for each fixed item.',
      'fixed_costs.total_within_estimate':
        'The quotes together do not exceed your estimate of the fixed costs.',
      'fixed_costs.cut_or_postpone': 'Cut the item or postpone it.',
      'worry.smallest_test':
        'The smallest test that answers your worry alone: show your idea to prospective customers and ask for a decision, not an opinion.',
      'worry.founder_sets_the_line': 'The worry is yours, so the line you accept is your choice.',
      'worry.ask_an_expert': 'Ask an expert in your field before you go on.',
    },
    rankCaption: 'How the tests were ranked',
    rankColumns: {
      assumption: 'Assumption',
      confidence: 'Your confidence',
      rank: 'Rank of effect on profit',
      priority: 'Priority',
    },
    priorityFormula: ({ ceiling, rankCeiling, high, medium, low }) =>
      inl`Priority = (${ceiling} − confidence) × (${rankCeiling} − effect rank), with confidence scored high ${high}, medium ${medium}, low ${low}.`,
    worryFirst: 'Your own worry always takes the first place.',
  },

  appendix: {
    assumptionsIntro:
      'This register lists every number in the report that is an assumption or has low confidence, with its source and level of confidence; test these numbers before you build a decision on them.',
    registerCaption: 'Numbers that are assumptions or have low confidence',
    registerColumns: {
      item: 'Number',
      value: 'Value',
      source: 'Source',
      confidence: 'Confidence',
      validated: 'Confirmed',
    },
    registerNone: 'No number in this report is an assumption or has low confidence.',
    registerItems: {
      price: 'Selling price',
      variableCost: 'Variable cost per unit',
      fixedCosts: 'Fixed costs per month',
      marketing: 'Marketing budget per month',
      staff: 'Team and salaries',
      sales: 'Sales forecast',
      capacity: 'Maximum capacity',
      churn: 'Churn',
      setupCosts: 'Set-up costs',
      capital: 'Available capital',
      runway: 'Time you can go without income',
      breakEvenTarget: 'Longest break-even wait you accepted',
      legalForm: 'Legal form',
      fundingNeed: 'Funding need',
      breakEvenMonth: 'Break-even month',
      firstYearProfit: 'Year-one operating profit',
    },
    sales: ({ month1, month6, month12 }) =>
      inl`${month1}, then ${month6}, then ${month12} units a month, in months one, six and twelve`,
    staffCount: ({ count }) => inl`Number of roles: ${count}`,
    capital: ({ min, max }) => inl`from ${min} to ${max}`,
    limitUnbounded: 'No upper limit set',
    legalForms: { sole: 'Sole proprietorship', company: 'Company' },
    notesTitle: 'Engine notes on your answers',
    notes: {
      price_from_competitors:
        'Your price was unknown, so the median of competitor prices was used.',
      marketing_assumed_zero: 'The marketing budget was not given, so it was taken as zero.',
      growth_estimated:
        'Yearly growth was not given, so the engine estimated it from sales in months six and twelve.',
      capacity_unlimited: 'The maximum capacity was not given, so there is no cap on units.',
      seasonality_unset: 'Seasonality was not given, so demand was taken as non-seasonal.',
      staff_unset: 'No hiring plan was given, so no salaries are in the calculation.',
      setup_costs_unset: 'Set-up costs were not given, so cash flow is not calculated.',
      seasonality_ignored:
        'The seasonal pattern has too many peak months, so the engine ignored it.',
      capacity_reached: 'Sales reached the maximum capacity in some months and were capped there.',
      inflation_not_applied:
        'No inflation was applied to costs because no rate with a documented source exists.',
      churn_unset: 'Churn is not given, so customer value is not calculated.',
      capital_unset: 'Available capital is not given, so it is not compared with set-up costs.',
      capital_other_currency:
        'Capital is in a currency other than the project’s, so it is not compared, and nothing is converted.',
      runway_unset: 'The time you can go without income is not given.',
      break_even_target_unset: 'The longest acceptable wait for break-even is not given.',
      legal_form_assumed_sole:
        'The legal form is undecided, so the engine assumed a sole proprietorship.',
      foreign_exposure_unset:
        'The share of costs tied to a foreign currency is not given, so no currency test is run.',
      financing_unset:
        'The funding source is not given, so the funding blocker is not applied to the verdict.',
      worry_unset: 'Your biggest worry is not given, so it does not lead the validation plan.',
    },
    parametersCaption: 'The engine’s named assumptions',
    parameterColumns: {
      parameter: 'Assumption',
      value: 'Value',
      source: 'Source',
      confidence: 'Confidence',
      validated: 'Confirmed',
    },
    parameters: {
      'engine.horizon_months': 'Projection horizon',
      'growth.upper_bound_yearly': 'Ceiling of the yearly growth estimate',
      'growth.founder_share': 'Share of your own growth the estimate keeps',
      'growth.year3_share_of_year2': 'Share of year-two growth applied to year three',
      'seasonality.peak_factor': 'Peak-month factor',
      'inflation.yearly': 'Yearly cost inflation',
      'scenario.conservative.sales_factor': 'Conservative scenario: sales multiplier',
      'scenario.optimistic.sales_factor': 'Optimistic scenario: sales multiplier',
      'scenario.conservative.vc_factor': 'Conservative scenario: variable cost multiplier',
      'scenario.optimistic.vc_factor': 'Optimistic scenario: variable cost multiplier',
      'scenario.conservative.launch_delay_months': 'Conservative scenario: launch delay',
      'pricing.penetration_floor_factor':
        'Penetration price factor above the lowest price that covers costs',
      'unit_economics.ltv_cac_minimum': 'Minimum accepted customer value to acquisition cost',
      'fx.cogs_shocks': 'Imported-cost shocks in the currency test',
      'scenario.tornado_swing': 'How far each number moves when ranking effect',
      'feasibility.window_months': 'Feasibility window for break-even and recovery',
      'verdict.go_score_line': 'Score line for the Go verdict',
      'verdict.funding_multiple': 'Funding blocker: multiple of the largest capital',
      'confidence.high_line': 'Line for high overall confidence',
      'confidence.medium_line': 'Line for medium overall confidence',
    },
    inflationNone: 'Not applied: no documented rate',
    sourcesIntro:
      'The official sources behind the steps of the legal path, with the date each was last verified.',
    sourcesCaption: 'Country data sources',
    sourcesColumns: { item: 'Item', source: 'Link', verified: 'Last verified', status: 'Status' },
    neverVerified: 'Never verified',
    sourcesNone: 'This report holds no verified sources for your country.',
    disclaimer: [
      'This report is a planning tool built on the numbers you entered and on the engine’s assumptions listed in Appendix A; it is not legal, tax, financial or investment advice.',
      'Neither the verdict nor any number guarantees how the project will fare in the market; test the assumptions with the validation plan before you spend on them.',
      'The legal and regulatory values in the report are taken from dated official sources, and anything old or unverified carries the line “Check the official source”.',
    ],
    notAProbability:
      'The feasibility score and the share of criteria met are not a probability of success.',
  },
};
