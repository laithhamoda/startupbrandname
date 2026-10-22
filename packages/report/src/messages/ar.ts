import { inl } from '../model/inline';
import type { ReportMessages } from './types';

/*
 * The report in Modern Standard Arabic (D-270). A draft for the owner's review (OPEN-QUESTIONS #98).
 * No digit appears in any message: every number enters through a slot. The English term in
 * parentheses is added by the report's term tracker, on first use only.
 */
export const ar: ReportMessages = {
  reportKind: 'تقرير نموذج العمل التجاري',
  sections: {
    cover: 'الغلاف',
    executive_summary: 'الملخص التنفيذي',
    project_card: 'بطاقة المشروع',
    canvases: 'لوحتا نموذج العمل',
    pricing_unit_economics: 'التسعير واقتصاديات الوحدة',
    projection: 'الإسقاط المالي',
    scenarios_sensitivity: 'السيناريوهات والحساسية',
    legal_path_financing: 'المسار القانوني والتمويل',
    validation_plan: 'خطة التحقق',
    appendix_assumptions: 'ملحق أ: سجل الافتراضات',
    appendix_sources: 'ملحق ب: المصادر',
    appendix_disclaimer: 'ملحق ج: إخلاء المسؤولية',
    verdict: 'الحكم',
    top_risks: 'أهم ثلاث مخاطر',
    break_even: 'تقدير التعادل',
  },
  verdictWords: { go: 'امضِ', revise: 'عدّل', stop: 'توقّف' },
  summaryVerdict: {
    go: 'التقرير الكامل يشرح أسباب هذا الحكم وما ينبغي الانتباه إليه وأنت تمضي.',
    revise: 'التقرير الكامل يشرح أسباب هذا الحكم وما الذي يستحق التعديل أولاً.',
    stop: 'التقرير الكامل يشرح الأسباب بالتفصيل وما الذي يمكن أن يغيّر الحكم.',
  },
  stopSentence: 'غير قابل للتنفيذ بصيغته الحالية',
  terms: {
    break_even: { name: 'نقطة التعادل', english: 'Break-even' },
    payback: { name: 'مدة استرداد رأس المال', english: 'Payback' },
    contribution_margin: { name: 'هامش المساهمة', english: 'Contribution margin' },
    ltv: { name: 'القيمة الدائمة للعميل', english: 'LTV' },
    cac: { name: 'تكلفة اكتساب العميل', english: 'CAC' },
    price_floor: { name: 'سعر الحدّ الأدنى', english: 'Price floor' },
    sensitivity: { name: 'تحليل الحساسية', english: 'Sensitivity analysis' },
  },

  words: {
    source: { user: 'من إجاباتك', assumption: 'افتراض', external: 'مصدر خارجي' },
    confidence: { high: 'مرتفعة', medium: 'متوسطة', low: 'منخفضة', missing: 'غير متوفرة' },
    validated: 'مؤكَّد',
    unvalidated: 'غير مؤكَّد',
    yes: 'نعم',
    no: 'لا',
    notCalculated: 'غير محسوب',
    perMonth: 'شهريًا',
    dash: '—',
    listSeparator: '، ',
  },
  lowConfidence: 'هذا الرقم افتراض، اختبره قبل أن تبني عليه قراراً.',
  verifyOfficialSource: 'تحقّق من المصدر الرسمي',
  adviserLine: 'نوصي بمراجعة مستشار ضريبي في بلدك قبل أي قرار.',

  month: ({ n }) => inl`الشهر ${n}`,
  months: ({ count, n }) => {
    if (count === 1) return ['شهر واحد'];
    // The oblique form: the phrase is almost always the object of a preposition (ضمن, خلال).
    if (count === 2) return ['شهرين'];
    return count <= 10 ? inl`${n} أشهر` : inl`${n} شهرًا`;
  },
  units: ({ count, n }) => {
    if (count === 1) return ['وحدة واحدة'];
    if (count === 2) return ['وحدتين'];
    return count >= 3 && count <= 10 ? inl`${n} وحدات` : inl`${n} وحدة`;
  },
  changes: ({ count, n }) => {
    if (count === 1) return ['تغيير واحد'];
    if (count === 2) return ['تغييرين'];
    return count >= 3 && count <= 10 ? inl`${n} تغييرات` : inl`${n} تغييرًا`;
  },
  within: ({ months }) => inl`ضمن ${months}`,
  noBreakEvenWithin: ({ months }) => inl`لا تعادل خلال ${months}`,
  noPaybackWithin: ({ months }) => inl`لا استرداد لرأس المال خلال ${months}`,
  quarter: ({ n }) => inl`الربع ${n}`,
  yearLabel: ({ n }) => inl`السنة ${n}`,
  yearTotal: 'مجموع السنة',
  total: 'المجموع',

  cover: {
    promise:
      'كل رقم في هذا التقرير يحسبه المحرك بمعادلات ثابتة ويحمل مصدره ومستوى ثقته. لا يكتب نموذج لغوي أي رقم.',
    facts: {
      project: 'المشروع',
      country: 'الدولة',
      currency: 'عملة التقرير',
      issuedOn: 'تاريخ الإصدار',
      engineVersion: 'نسخة المحرك',
      completeness: 'اكتمال الإجابات',
      confidence: 'الثقة الإجمالية',
    },
    currencyValue: ({ name, code }) => inl`${name} (${code})`,
    confidenceValue: ({ level, sound, total }) =>
      inl`${level} (${sound} من ${total} من الإجابات المحورية سليمة)`,
  },

  executive: {
    opening: {
      investor:
        'هذا التقرير موجّه إلى مستثمر محتمل، فيبدأ بما يهمه أولًا: ربح السنة الأولى، ثم موعد التعادل، ثم ما تحتاجه من تمويل.',
      bank: 'هذا التقرير موجّه إلى بنك، فيبدأ بما يهمه أولًا: احتياج التمويل، ثم موعد التعادل، ثم ربح السنة الأولى.',
      grant:
        'هذا التقرير موجّه إلى جهة مانحة، فيبدأ بموعد التعادل، ثم احتياج التمويل، ثم ربح السنة الأولى.',
      course:
        'هذا التقرير مهمة في دورة تدريبية، فيعرض الحكم والأرقام الثلاثة بترتيبها المعتاد ليسهل عليك شرح طريقة التحليل.',
      self: 'هذا التقرير لك أنت، فيعرض الحكم ثم أهم ثلاثة أرقام وأهم المخاطر.',
    },
    reason: {
      go: ({ passed, evaluated, score, line }) =>
        inl`يتحقق ${passed} من ${evaluated} من معايير الجدوى (${score})، وهذا يبلغ خط «امضِ» (${line}) أو يتجاوزه، ولا يوجد معيار حاجب، وثقتك في الأرقام المحورية كافية.`,
      noBlocker: 'لا يوجد معيار حاجب.',
      blockers: ({ count }) => inl`توجد شروط حاجبة (${count})، وهي مذكورة في المخاطر أدناه.`,
      score: ({ passed, evaluated, score, line }) =>
        inl`يتحقق ${passed} من ${evaluated} من معايير الجدوى (${score})، وخط «امضِ» ${line}.`,
      changesReach: ({ changes }) =>
        inl`وجدنا ${changes} في أرقامك، وتطبيق ذلك يصل بالمشروع إلى «امضِ».`,
      changesImprove: ({ changes }) =>
        inl`وجدنا ${changes} في أرقامك، وتطبيق ذلك يحسّن النتيجة لكنه لا يصل بالمشروع إلى «امضِ» وحده.`,
      goNeedsConfidence: 'ولا يصل المشروع إلى «امضِ» ما دامت ثقتك في الأرقام المحورية منخفضة.',
      notProbability: 'الدرجة ليست احتمال نجاح، بل نسبة المعايير التي تحققت.',
    },
    holdBacks: {
      score_below_line: ({ passed, evaluated, score, line }) =>
        inl`يتحقق ${passed} من ${evaluated} من معايير الجدوى (${score})، وهذا دون خط «امضِ» (${line}).`,
      no_score: () => ['لم يُقيَّم أي معيار من معايير الجدوى لقلة الإجابات.'],
      confidence_low: ({ sound, total }) =>
        inl`ثقتك الإجمالية منخفضة: ${sound} من ${total} من الإجابات المحورية سليمة.`,
    },
    meterCaption: ({ passed, evaluated, line }) =>
      inl`معايير الجدوى المتحققة: ${passed} من ${evaluated}. حدّ «امضِ» عند ${line}.`,
    keyNumbers: {
      fundingNeed: 'احتياج التمويل',
      breakEven: 'شهر التعادل',
      firstYearProfit: 'ربح التشغيل في السنة الأولى',
      fundingNeedCaption: ({ month }) => inl`أدنى رصيد نقدي، في ${month}`,
      fundingNeedNone: 'يلزم تحديد تكاليف التأسيس لحسابه',
      breakEvenCaption: ({ term }) => inl`${term}: أول شهر يغطي فيه الدخل التكاليف`,
      breakEvenNone: 'هامش الوحدة ليس موجبًا، فلا تعادل',
      firstYearProfitCaption: 'ربح التشغيل قبل الضريبة',
    },
    risksTitle: 'أهم المخاطر',
    blocksCaption: 'المعايير التي لم تتحقق',
    blocksColumns: { criterion: 'المعيار', measured: 'المحسوب', limit: 'الحدّ' },
    blocksNote: ({ evaluated, total }) =>
      inl`قُيِّم ${evaluated} من أصل ${total} من المعايير، والمعيار الذي تنقصه إجابات لا يُحتسب.`,
    criteria: {
      margin_positive: 'هامش الوحدة موجب',
      break_even_within_window: 'التعادل ضمن نافذة الجدوى',
      break_even_within_target: 'التعادل ضمن أطول مدة قبلتها',
      break_even_within_runway: 'التعادل ضمن المدة التي تتحمّلها بلا دخل',
      funding_within_capital: 'احتياج التمويل ضمن أقصى رأس مال متاح',
      setup_within_capital: 'تكاليف التأسيس ضمن أقصى رأس مال متاح',
      price_above_floor: 'السعر ليس أقل من أدنى سعر يغطي التكاليف',
      ltv_cac_at_minimum: 'نسبة قيمة العميل إلى تكلفة اكتسابه ليست دون الحدّ الأدنى',
      conservative_break_even: 'التعادل في السيناريو المتحفّظ',
      payback_within_window: 'استرداد رأس المال ضمن نافذة الجدوى',
      break_even_units_within_capacity: 'وحدات التعادل ضمن الطاقة القصوى',
    },
    changesCaption: {
      stop: 'تغييرات محسوبة في أرقامك تغيّر الحكم',
      revise: 'تغييرات في أرقامك تقرّب المشروع من «امضِ»',
    },
    changesColumns: {
      change: 'التغيير',
      now: 'الآن',
      suggested: 'المقترح',
      delta: 'التغيّر',
      result: 'النتيجة',
    },
    changeResult: ({ verdict, passed, evaluated }) => inl`${verdict} · ${passed} من ${evaluated}`,
    changeLevers: {
      price: { up: 'رفع السعر', down: 'خفض السعر' },
      variable_cost: { up: 'رفع التكلفة المتغيرة', down: 'خفض التكلفة المتغيرة' },
      fixed_costs: { up: 'زيادة التكاليف الثابتة', down: 'خفض التكاليف الثابتة' },
      sales: { up: 'زيادة المبيعات', down: 'خفض المبيعات' },
      setup_costs: { up: 'رفع تكاليف التأسيس', down: 'خفض تكاليف التأسيس' },
    },
    leverBasis: {
      price: 'مقارنةً بما أدخلته',
      variable_cost: 'مقارنةً بما أدخلته',
      fixed_costs: 'نسبةً إلى تقديرك الحالي',
      sales: 'نسبةً إلى توقّعك الحالي',
      setup_costs: 'مقارنةً بما أدخلته',
    },
    leverNames: {
      price: 'السعر',
      variable_cost: 'التكلفة المتغيرة',
      fixed_costs: 'التكاليف الثابتة',
      sales: 'المبيعات',
      setup_costs: 'تكاليف التأسيس',
    },
    premiumNote: ({ ceiling }) =>
      inl`أعلى من أعلى منافس (${ceiling}): يلزمه فرق قابل للقياس في عرضك.`,
    premiumNoteNoCeiling: 'سعر فوق نطاق المنافسين: يلزمه فرق قابل للقياس في عرضك.',
    rethinkTitle: 'أعد التفكير في هذه الأرقام، فلا قيمة محددة تكفي وحدها',
    rethinkItem: ({ lever, swing }) =>
      inl`${lever}: يتحرك ربح السنة الأولى بمقدار ${swing} عبر المدى المختبر.`,
    changesUnavailable: 'لم تُحسب التغييرات المقترحة لهذا المشروع بعد.',
    confidenceLine: ({ level, sound, total }) =>
      inl`الثقة الإجمالية في إجاباتك ${level} (${sound} من ${total} من الإجابات المحورية سليمة).`,
    beforeTax: 'كل الأرقام قبل الضريبة، لأن الضريبة لم تُحسب.',
  },

  risks: {
    none: 'لا مخاطر كبيرة ظاهرة من إجاباتك الحالية.',
    figures: {
      F1: 'سعر البيع',
      F3: 'التكلفة المتغيرة للوحدة',
      F4: 'التكاليف الثابتة',
      F5: 'تكاليف التأسيس',
      F6: 'توقّعات المبيعات',
    },
    pivotalMissing: ({ figure }) => inl`لم تُجب بعد عن ${figure}، فلا يكتمل الحساب.`,
    pivotalAssumed: ({ figure }) =>
      inl`${figure} افتراض غير مؤكَّد، فاختبره قبل أن تبني عليه قراراً.`,
    worry: ({ worry }) => inl`قلقك أنت: «${worry}».`,
    blockers: {
      margin_not_positive: ({ margin }) =>
        inl`هامش الوحدة (${margin}) ليس موجبًا: كل بيعة تخسر مالًا، فلا يوجد تعادل.`,
      no_break_even_in_window: ({ window }) => inl`لا تعادل ضمن ${window} في الحالة الأساسية.`,
      funding_need_above_capital_multiple: ({ need, capital, multiple }) =>
        inl`احتياج التمويل (${need}) يفوق أقصى رأس مال ذكرتَه (${capital}) بأكثر من المضاعف ${multiple}، ولم تذكر مصدر تمويل خارجيًا.`,
    },
  },

  alerts: {
    cm_not_positive: ({ measured, limit }) =>
      inl`هامش الوحدة (${measured}) ليس أعلى من الحدّ (${limit}).`,
    break_even_units_above_capacity: ({ measured, limit }) =>
      inl`وحدات التعادل (${measured}) أكثر من طاقتك القصوى الشهرية (${limit}).`,
    break_even_month_above_target: ({ measured, limit }) =>
      inl`التعادل (${measured}) بعد أطول مدة قبلتها (${limit}).`,
    break_even_month_above_runway: ({ measured, limit }) =>
      inl`التعادل (${measured}) بعد المدة التي تتحمّلها بلا دخل (${limit}).`,
    setup_costs_above_capital: ({ measured, limit }) =>
      inl`تكاليف التأسيس (${measured}) أعلى من أقصى رأس مال متاح (${limit}).`,
    setup_costs_within_capital_range: ({ measured, limit, lowerLimit }) =>
      inl`تكاليف التأسيس (${measured}) فوق أدنى رأس مال متاح (${lowerLimit}) وتحت أقصاه (${limit}).`,
    price_below_floor: ({ measured, limit }) =>
      inl`السعر (${measured}) أقل من أدنى سعر يغطي تكاليفك (${limit}).`,
    ltv_to_cac_below_minimum: ({ measured, limit }) =>
      inl`نسبة قيمة العميل إلى تكلفة اكتسابه (${measured}) أقل من الحدّ الأدنى (${limit}).`,
    turnover_above_regime_ceiling: ({ measured, limit, year, regime }) =>
      inl`إيراداتك في السنة ${year} (${measured}) تتجاوز سقف النظام الضريبي ${regime} (${limit}).`,
    turnover_above_vat_threshold: ({ measured, limit, year }) =>
      inl`إيراداتك في السنة ${year} (${measured}) تتجاوز حدّ التسجيل في ضريبة المبيعات (${limit}).`,
    tax_regime_not_calculated: () => ['لم تُحسب الضريبة لغياب قاعدة موثّقة، فالأرقام قبل الضريبة.'],
  },
  taxGaps: {
    no_rule: () => [
      'لا توجد لهذه الحالة قاعدة ضريبية موثّقة ومتحقَّق منها، فلا نحسب رقمًا من عندنا.',
    ],
    ambiguous_regime: ({ regimes }) =>
      inl`ينطبق أكثر من نظام ضريبي (${regimes}) ولا نختار بينها نيابةً عنك، فلا نحسب رقمًا من عندنا.`,
    rule_other_currency: ({ currency }) =>
      inl`القاعدة الضريبية المتوفرة بعملة أخرى (${currency}) ولا نحوّل العملات، فلا نحسب رقمًا من عندنا.`,
  },

  breakEven: {
    estimate: ({ term, month, revenue, units }) =>
      inl`يبلغ مشروعك ${term} في ${month} وفق تقديرنا، عند ${units} شهريًا وإيراد شهري قدره ${revenue}.`,
    notReached: ({ term, horizon }) =>
      inl`لا يبلغ المشروع ${term} خلال ${horizon} بالأرقام الحالية.`,
    blocked: ({ term, margin }) => inl`لا يوجد ${term}: هامش الوحدة (${margin}) ليس موجبًا.`,
    notEnough: ({ term }) => inl`إجاباتك الحالية لا تكفي بعد لتقدير ${term}.`,
    missingIntro: 'ما ينقص',
    caveat: 'تقدير من أرقامك وافتراضات المحرك، وليس وعدًا بنتيجة.',
  },
  notCalculable: {
    invalid_project: () => ['بيانات المشروع (الدولة أو العملة أو التاريخ) غير صالحة.'],
    missing_answer: ({ question }) => inl`ينقص: ${question}.`,
    unknown_answer: ({ question }) => inl`أجبتَ «لا أعرف» عن: ${question}، ونحتاج قيمة حقيقية.`,
    currency_mismatch: ({ question, currency }) =>
      inl`عملة ${question} (${currency}) تختلف عن عملة التقرير، ولا نحوّل العملات.`,
    invalid_value: ({ question }) => inl`قيمة ${question} غير صالحة.`,
    no_price: () => ['لا يوجد سعر نحسب منه: أدخل سعر البيع أو أسعار المنافسين.'],
  },

  card: {
    rows: {
      team: 'الفريق',
      idea: 'الفكرة',
      customerType: 'من يدفع',
      customerProfile: 'العميل الأول',
      location: 'المكان',
      workplace: 'مكان العمل',
      sector: 'القطاع',
      projectType: 'نوع المشروع',
      pricingModel: 'نموذج التسعير',
      price: 'سعر البيع',
      capital: 'رأس المال المتاح',
      goal: 'الهدف من المشروع',
    },
    empty: 'لم تُجب بعد عن الأسئلة التي تعرّف المشروع.',
    location: ({ city, country }) => inl`${city}، ${country}`,
    moneyRange: ({ min, max }) => inl`من ${min} إلى ${max}`,
  },

  canvases: {
    intro: 'كل خلية تعرض كلماتك أنت كما كتبتها، مع مصدرها ومستوى ثقتها؛ ولا يكتب النظام نصًا عنك.',
    names: { business_model: 'لوحة نموذج العمل', lean: 'اللوحة الرشيقة' },
    blocks: {
      customerSegments: 'شرائح العملاء',
      valuePropositions: 'القيمة المقدّمة',
      channels: 'القنوات',
      customerRelationships: 'علاقات العملاء',
      revenueStreams: 'مصادر الإيراد',
      keyResources: 'الموارد الرئيسية',
      keyActivities: 'الأنشطة الرئيسية',
      keyPartners: 'الشركاء الرئيسيون',
      costStructure: 'هيكل التكاليف',
      problem: 'المشكلة',
      solution: 'الحل',
      keyMetrics: 'المقاييس الرئيسية',
      uniqueValueProposition: 'القيمة الفريدة',
      unfairAdvantage: 'الميزة غير العادلة',
    },
    empty: {
      unanswered: 'لم تُجب بعد عن السؤال المرتبط بهذه الخلية.',
      unknown: 'أجبتَ «لا أعرف» عن السؤال المرتبط بهذه الخلية.',
      empty: 'أجبتَ عن السؤال لكنك لم تُدرج شيئًا.',
      no_question: 'لا يوجد في التشخيص سؤال يملأ هذه الخلية بعد.',
    },
    totals: {
      fixedMonthly: 'مجموع التكاليف الثابتة شهريًا',
      variableUnit: 'التكلفة المتغيرة للوحدة',
      setup: 'مجموع تكاليف التأسيس',
    },
  },

  pricing: {
    unitCaption: 'اقتصاديات الوحدة والتعادل',
    columns: { item: 'البند', value: 'القيمة' },
    rows: {
      price: 'سعر البيع للوحدة',
      variableCost: 'التكلفة المتغيرة للوحدة',
      fixedEntered: 'التكاليف الثابتة التي أدخلتها شهريًا',
      margin: ({ term }) => inl`${term} للوحدة`,
      marginRate: 'نسبة الهامش',
      fixedTotal: 'مجموع التكاليف الثابتة شهريًا كما يحسبها المحرك',
      breakEvenUnits: 'وحدات التعادل شهريًا',
      breakEvenRevenue: 'إيراد التعادل شهريًا',
      breakEvenMonth: ({ term }) => inl`شهر ${term}`,
    },
    blocked: ({ margin }) =>
      inl`هامش الوحدة (${margin}) ليس موجبًا: لا يمكن حساب التعادل، وعليك رفع السعر أو خفض التكلفة المتغيرة أولًا.`,
    capacityUnlimited: 'لم تحدّد طاقة قصوى شهرية، فلا نقارن وحدات التعادل بها.',
    capacityWithin: ({ units, capacity }) =>
      inl`وحدات التعادل (${units}) ضمن طاقتك القصوى الشهرية (${capacity}).`,
    capacityAbove: ({ units, capacity }) =>
      inl`وحدات التعادل (${units}) أكثر من طاقتك القصوى الشهرية (${capacity}).`,
    subscriptionCaption: 'قياسات الاشتراك',
    subscriptionRows: {
      arpu: 'متوسط الإيراد لكل مشترك شهريًا',
      churn: 'نسبة الإلغاء الشهرية',
      ltv: ({ term }) => inl`${term}`,
      newCustomers: 'مشتركون جدد شهريًا',
      cac: ({ term }) => inl`${term}`,
      ltvToCac: 'النسبة بين قيمة العميل وتكلفة اكتسابه',
    },
    subscriptionGaps: {
      churn_unset: 'لم تحدّد نسبة الإلغاء، فلا تُحسب قيمة العميل.',
      churn_zero: 'نسبة الإلغاء صفر، فلا تُحسب قيمة عميل محدودة.',
      no_new_customers: 'لا مشتركون جدد في الإسقاط، فلا تُحسب تكلفة الاكتساب.',
      no_marketing: 'لا ميزانية تسويق، فلا تُحسب تكلفة الاكتساب.',
    },
    marketCaption: 'مواضع السعر في السوق',
    marketRows: {
      floor: ({ term }) => inl`${term}`,
      bandMin: 'أدنى سعر عند المنافسين',
      bandMedian: 'وسيط أسعار المنافسين',
      bandMax: 'أعلى سعر عند المنافسين',
      penetration: 'سعر الاختراق',
      market: 'سعر السوق',
      premium: 'السعر المميّز',
    },
    marketGaps: {
      no_units: 'لا وحدات مبيعة في السنة الأولى، فلا يُحسب أدنى سعر يغطي التكاليف.',
      no_competitor_prices: 'لا أسعار منافسين، فلا يُحسب نطاق السوق.',
    },
    premiumAllowed:
      'اجتازت إجابتك عن سبب اختيار العميل لك فحص الفرق القابل للقياس، فيدخل السعر المميّز في المقارنة.',
    premiumNotAllowed:
      'السعر المميّز يلزمه فرق قابل للقياس في عرضك، ولم تُظهر إجابتك فرقًا كهذا بعد.',
  },

  projection: {
    intro: ({ timing }) =>
      inl`الإيراد يُحصَّل ${timing}. الأرقام قبل الضريبة ما لم يُذكر غير ذلك، والأشهر تُقرأ من اليمين.`,
    yearOneCaption: 'السنة الأولى شهرًا بشهر',
    laterYearCaption: ({ year }) => inl`السنة ${year}: بالأرباع (كل ربع ثلاثة أشهر)`,
    rows: {
      units: 'الوحدات المبيعة',
      revenue: 'الإيرادات',
      cogs: 'تكلفة المبيعات',
      grossProfit: 'الربح الإجمالي',
      operatingCosts: 'التكاليف التشغيلية',
      operatingProfit: 'ربح التشغيل',
      netCash: 'صافي النقد',
      cumulativeCash: 'الرصيد النقدي التراكمي',
      cumulativeCashBeforeTax: 'الرصيد النقدي التراكمي قبل الضريبة',
    },
    monthHeader: 'الشهر',
    itemHeader: 'البند',
    startsFrom: ({ setup }) => inl`الرصيد النقدي يبدأ من ${setup}، وهي تكاليف التأسيس.`,
    legendLowest: ({ month }) => inl`أدنى رصيد نقدي في ${month}، وهو احتياج التمويل.`,
    legendBreakEven: ({ term, month }) => inl`${term}: أول شهر يربح فيه التشغيل، وهو ${month}.`,
    paybackLine: ({ term, month }) => inl`${term}: يعود رأس المال الذي أنفقته في ${month}.`,
    paybackNone: ({ term, horizon }) =>
      inl`${term}: لا يعود رأس المال الذي أنفقته خلال ${horizon} بالأرقام الحالية.`,
    cashNotCalculated: 'لم تُحسب التدفقات النقدية لأنك لم تحدّد تكاليف التأسيس.',
    timingWords: {
      cash: 'نقدًا في الشهر نفسه',
      credit: 'بالآجل بعد الشهر نفسه',
      instalments: 'بالتقسيط على أشهر متتالية',
      deposit: 'بدفعة مقدّمة والباقي لاحقًا',
      assumed: 'نقدًا في الشهر نفسه، افتراضًا لأنك لم تحدّد طريقة التحصيل',
    },
    taxNotIncluded: 'الضريبة غير مُدرجة في هذه الأرقام.',
  },

  scenarios: {
    caption: 'السيناريوهات الثلاثة',
    names: { conservative: 'المتحفّظ', base: 'الأساسي', optimistic: 'المتفائل' },
    rows: {
      assumptions: 'الافتراضات',
      breakEvenMonth: 'شهر التعادل',
      fundingNeed: 'احتياج التمويل',
      firstYearProfit: 'ربح التشغيل في السنة الأولى',
    },
    baseAssumptions: 'أرقامك كما أدخلتها',
    assumptions: ({ sales, cost }) => inl`المبيعات × ${sales}، والتكلفة المتغيرة × ${cost}`,
    assumptionsDelay: ({ sales, cost, delay }) =>
      inl`المبيعات × ${sales}، والتكلفة المتغيرة × ${cost}، وتأخير الإطلاق ${delay}`,
    fundingNotCalculated: 'يلزم تحديد تكاليف التأسيس',
    tornadoCaption: ({ term, change }) =>
      inl`${term}: ترتيب الأرقام الأربعة بحسب أثرها في ربح السنة الأولى، وكل رقم يتحرك ${change} صعودًا وهبوطًا`,
    tornadoColumns: {
      variable: 'الرقم',
      low: 'ربح السنة الأولى عند الحدّ الأدنى',
      high: 'ربح السنة الأولى عند الحدّ الأعلى',
      swing: 'المدى',
    },
    variables: {
      price: 'السعر',
      vc: 'التكلفة المتغيرة',
      sales: 'المبيعات',
      fixed_costs: 'التكاليف الثابتة',
    },
    tornadoNote: 'الرقم الأعلى في الجدول أولى بالاختبار قبل أن تنفق.',
  },

  legal: {
    noPack: ({ country }) =>
      inl`لا توجد حزمة بيانات موثّقة لدولة ${country} بعد، فلا نعرض لها مسار تسجيل ولا قيمًا قانونية؛ راجع الجهات الرسمية في بلدك.`,
    guideTitle: 'خطوات التسجيل والتراخيص',
    roles: {
      path: 'المسار الرئيس',
      condition: 'شرط',
      alternative: 'مسار بديل',
      comparison: 'للمقارنة',
      sector: 'بحسب قطاعك',
      home: 'عمل من المنزل',
      confirm: 'تأكّد من الجهة الرسمية',
      note: 'ملاحظة',
      always: 'دائمًا',
    },
    missingItems: ({ count }) =>
      inl`بنود من الحزمة (${count}) غير متوفرة بعد، فلا تغطي هذه الخطوات كل ما قد ينطبق عليك.`,
    taxCalculated: ({ regime }) => inl`حُسبت الضريبة في الإسقاط وفق النظام «${regime}».`,
    taxCaption: 'الضريبة المحسوبة لكل سنة',
    taxColumns: { year: 'السنة', turnover: 'الإيراد', profit: 'ربح التشغيل', tax: 'الضريبة' },
    noOfficialLink:
      'لا يوجد رابط رسمي للجهة الضريبية في بيانات هذه الدولة بعد، ولن نضع رابطًا من عندنا.',
    financingTitle: 'التمويل',
    fundingVsCapitalWithin: ({ need, min, max }) =>
      inl`احتياج التمويل (${need}) لا يتجاوز أقصى رأس مال ذكرتَه (${max})، وأدنى رأس مال لديك ${min}.`,
    fundingVsCapitalAbove: ({ need, max }) =>
      inl`احتياج التمويل (${need}) أعلى من أقصى رأس مال ذكرتَه (${max}): الفرق يحتاج مصدرًا خارجيًا أو تغييرًا في أرقامك.`,
    fundingNoCapital: ({ need }) =>
      inl`احتياج التمويل ${need}، ولم تحدّد رأس مال متاحًا لنقارنه به.`,
    fundingNotCalculated: 'لم يُحسب احتياج التمويل لأنك لم تحدّد تكاليف التأسيس.',
    outsideSources: ({ sources }) => inl`مصادر التمويل الخارجية التي اخترتها: ${sources}.`,
    noOutsideSources: 'لم تختر مصدر تمويل خارجيًا.',
    shariaYes:
      'تفضّل تمويلًا متوافقًا مع الشريعة، فاسأل مزوّد التمويل عن صيغة العقد وجهة الرقابة الشرعية قبل أي التزام.',
  },

  validation: {
    intro: ({ days }) =>
      inl`خطة اختبار مدتها ${days} يومًا: اختبر الافتراضات الأهم قبل أن تنفق عليها، مرتبةً بحسب أثر كل افتراض في ربحك ومدى ثقتك به.`,
    worryTitle: 'قلقك أنت',
    worryQuote: ({ worry }) => inl`«${worry}»`,
    entryTitle: ({ n }) => inl`الاختبار ${n}`,
    why: {
      price: ({ value, change, swing, confidence }) =>
        inl`سعرك ${value}. تغييره بنسبة ${change} يحرّك ربح السنة الأولى بمقدار ${swing}. ثقتك فيه ${confidence}.`,
      vc: ({ value, change, swing, confidence }) =>
        inl`تكلفتك المتغيرة للوحدة ${value}. تغييرها بنسبة ${change} يحرّك ربح السنة الأولى بمقدار ${swing}. ثقتك فيها ${confidence}.`,
      sales: ({ value, change, swing, confidence }) =>
        inl`توقّعك للمبيعات في الشهر الثاني عشر ${value} وحدة شهريًا. تغييره بنسبة ${change} يحرّك ربح السنة الأولى بمقدار ${swing}. ثقتك فيه ${confidence}.`,
      fixed_costs: ({ value, change, swing, confidence }) =>
        inl`تكاليفك الثابتة ${value} شهريًا. تغييرها بنسبة ${change} يحرّك ربح السنة الأولى بمقدار ${swing}. ثقتك فيها ${confidence}.`,
    },
    labels: {
      why: 'لماذا',
      test: 'الاختبار',
      success: 'حدّ النجاح',
      fallback: 'إن لم ينجح',
      cost: 'التكلفة',
    },
    successDefault: 'هذا وصف افتراضي من بروتوكول الاختبار، وتضع أنت الرقم الذي تقبله قبل أن تبدأ.',
    costClasses: {
      time: 'وقتك',
      small_cash: 'مبلغ نقدي صغير',
      supplier_quote: 'عروض أسعار من الموردين',
    },
    codes: {
      'price.willingness_to_pay':
        'اعرض المنتج أو الخدمة بهذا السعر على عملاء محتملين وسجّل من يقبل أن يدفع فعلًا.',
      'price.accepting_share': 'نسبة من تعرض عليهم ويقبلون الدفع فعلًا، لا من يعجبهم العرض فقط.',
      'price.test_second_price': 'جرّب سعرًا ثانيًا على مجموعة جديدة.',
      'variable_cost.supplier_quotes':
        'اطلب عروض أسعار مكتوبة من مورّدين لكل بند من التكلفة المتغيرة.',
      'variable_cost.quotes_within_estimate': 'العروض لا تتجاوز تقديرك للتكلفة المتغيرة.',
      'variable_cost.second_supplier': 'اطلب عرضًا من مورّد ثانٍ أو بدّل المادة.',
      'sales.paid_preorders': 'اجمع طلبات مسبقة مدفوعة من عملاء حقيقيين.',
      'sales.preorders_against_month_one': 'عدد الطلبات المسبقة مقارنةً بتوقّعك للشهر الأول.',
      'sales.revise_forecast': 'عدّل توقّع المبيعات وأعد الحساب.',
      'fixed_costs.written_quotes': 'اطلب عرض سعر مكتوبًا لكل بند ثابت.',
      'fixed_costs.total_within_estimate': 'مجموع العروض لا يتجاوز تقديرك للتكاليف الثابتة.',
      'fixed_costs.cut_or_postpone': 'اخفض البند أو أجّله.',
      'worry.smallest_test':
        'أصغر اختبار يجيب عن قلقك وحده: اعرض فكرتك على عملاء محتملين واطلب منهم قرارًا لا رأيًا.',
      'worry.founder_sets_the_line': 'القلق قلقك، فالحدّ الذي ترضى به من اختيارك.',
      'worry.ask_an_expert': 'اسأل خبيرًا في مجالك قبل أن تتابع.',
    },
    rankCaption: 'كيف رُتّبت الاختبارات',
    rankColumns: {
      assumption: 'الافتراض',
      confidence: 'ثقتك فيه',
      rank: 'ترتيب أثره في الربح',
      priority: 'الأولوية',
    },
    priorityFormula: ({ ceiling, rankCeiling, high, medium, low }) =>
      inl`الأولوية = (${ceiling} − الثقة) × (${rankCeiling} − ترتيب الأثر)، والثقة: مرتفعة ${high}، متوسطة ${medium}، منخفضة ${low}.`,
    worryFirst: 'قلقك الشخصي يأخذ المكان الأول دائمًا.',
  },

  appendix: {
    assumptionsIntro:
      'يجمع هذا السجل كل رقم في التقرير مصدره افتراض أو ثقته منخفضة، مع مصدره ومستوى ثقته؛ اختبر هذه الأرقام قبل أن تبني عليها قراراً.',
    registerCaption: 'الأرقام التي مصدرها افتراض أو ثقتها منخفضة',
    registerColumns: {
      item: 'الرقم',
      value: 'القيمة',
      source: 'المصدر',
      confidence: 'الثقة',
      validated: 'التأكيد',
    },
    registerNone: 'لا يوجد رقم في هذا التقرير مصدره افتراض أو ثقته منخفضة.',
    registerItems: {
      price: 'سعر البيع',
      variableCost: 'التكلفة المتغيرة للوحدة',
      fixedCosts: 'التكاليف الثابتة شهريًا',
      marketing: 'ميزانية التسويق شهريًا',
      staff: 'الفريق والرواتب',
      sales: 'توقّعات المبيعات',
      capacity: 'الطاقة القصوى',
      churn: 'نسبة الإلغاء',
      setupCosts: 'تكاليف التأسيس',
      capital: 'رأس المال المتاح',
      runway: 'المدة التي تتحمّلها بلا دخل',
      breakEvenTarget: 'أطول مدة للتعادل قبلتها',
      legalForm: 'الشكل القانوني',
      fundingNeed: 'احتياج التمويل',
      breakEvenMonth: 'شهر التعادل',
      firstYearProfit: 'ربح التشغيل في السنة الأولى',
    },
    sales: ({ month1, month6, month12 }) =>
      inl`${month1} ثم ${month6} ثم ${month12} وحدة شهريًا، في الشهر الأول والسادس والثاني عشر`,
    staffCount: ({ count }) => inl`عدد المناصب: ${count}`,
    capital: ({ min, max }) => inl`من ${min} إلى ${max}`,
    limitUnbounded: 'بلا حدّ أعلى محدد',
    legalForms: { sole: 'منشأة فردية', company: 'شركة' },
    notesTitle: 'ملاحظات المحرك على إجاباتك',
    notes: {
      price_from_competitors: 'لم يُعرف سعرك فأُخذ وسيط أسعار المنافسين.',
      marketing_assumed_zero: 'لم تُحدَّد ميزانية التسويق فاعتُبرت صفرًا.',
      growth_estimated:
        'لم يُحدَّد النمو السنوي فقدّره المحرك من مبيعات الشهرين السادس والثاني عشر.',
      capacity_unlimited: 'لم تُحدَّد الطاقة القصوى فلا سقف لعدد الوحدات.',
      seasonality_unset: 'لم تُحدَّد الموسمية فاعتُبر الطلب غير موسمي.',
      staff_unset: 'لم تُحدَّد خطة الموظفين فلا رواتب في الحساب.',
      setup_costs_unset: 'لم تُحدَّد تكاليف التأسيس فلا يُحسب التدفق النقدي.',
      seasonality_ignored: 'في نمط الموسمية أشهر ذروة كثيرة جدًا فتجاهله المحرك.',
      capacity_reached: 'بلغت المبيعات الطاقة القصوى في بعض الأشهر فقُصَّت عندها.',
      inflation_not_applied: 'لم يُطبَّق تضخم على التكاليف لأنه لا توجد نسبة موثّقة بمصدرها.',
      churn_unset: 'نسبة الإلغاء غير محددة فلا تُحسب قيمة العميل.',
      capital_unset: 'رأس المال المتاح غير محدد فلا يُقارَن بتكاليف التأسيس.',
      capital_other_currency: 'رأس المال بعملة غير عملة المشروع فلا يُقارَن، ولا يوجد تحويل.',
      runway_unset: 'المدة التي تتحمّلها بلا دخل غير محددة.',
      break_even_target_unset: 'أطول مدة مقبولة حتى التعادل غير محددة.',
      legal_form_assumed_sole: 'الشكل القانوني غير محسوم فافترض المحرك منشأة فردية.',
      foreign_exposure_unset:
        'حصة التكاليف المرتبطة بعملة أجنبية غير محددة فلا يُجرى اختبار العملة.',
      financing_unset: 'مصدر التمويل غير محدد فلا يُطبَّق حاجب احتياج التمويل في الحكم.',
      worry_unset: 'أكبر ما يقلقك غير محدد فلا يتصدّر خطة التحقق.',
    },
    parametersCaption: 'افتراضات المحرك المسمّاة',
    parameterColumns: {
      parameter: 'الافتراض',
      value: 'القيمة',
      source: 'المصدر',
      confidence: 'الثقة',
      validated: 'التأكيد',
    },
    parameters: {
      'engine.horizon_months': 'أفق الإسقاط',
      'growth.upper_bound_yearly': 'سقف تقدير النمو السنوي',
      'growth.founder_share': 'حصة نمو المؤسس التي يحتفظ بها التقدير',
      'growth.year3_share_of_year2': 'حصة السنة الثالثة من نمو السنة الثانية',
      'seasonality.peak_factor': 'معامل شهر الذروة',
      'inflation.yearly': 'التضخم السنوي للتكاليف',
      'scenario.conservative.sales_factor': 'السيناريو المتحفّظ: مضاعف المبيعات',
      'scenario.optimistic.sales_factor': 'السيناريو المتفائل: مضاعف المبيعات',
      'scenario.conservative.vc_factor': 'السيناريو المتحفّظ: مضاعف التكلفة المتغيرة',
      'scenario.optimistic.vc_factor': 'السيناريو المتفائل: مضاعف التكلفة المتغيرة',
      'scenario.conservative.launch_delay_months': 'السيناريو المتحفّظ: تأخير الإطلاق',
      'pricing.penetration_floor_factor': 'معامل سعر الاختراق فوق أدنى سعر يغطي التكاليف',
      'unit_economics.ltv_cac_minimum': 'أدنى نسبة مقبولة بين قيمة العميل وتكلفة اكتسابه',
      'fx.cogs_shocks': 'صدمات تكلفة المستورد في اختبار العملة',
      'scenario.tornado_swing': 'مدى حركة كل رقم عند ترتيب الأثر',
      'feasibility.window_months': 'نافذة الجدوى للتعادل والاسترداد',
      'verdict.go_score_line': 'خط الدرجة للحكم «امضِ»',
      'verdict.funding_multiple': 'حاجب التمويل: المضاعف المسموح لأقصى رأس مال',
      'confidence.high_line': 'خط الثقة الإجمالية المرتفعة',
      'confidence.medium_line': 'خط الثقة الإجمالية المتوسطة',
    },
    inflationNone: 'غير مطبّق: لا نسبة موثّقة',
    sourcesIntro:
      'المصادر الرسمية التي استندت إليها خطوات المسار القانوني، مع تاريخ آخر تحقّق من كل منها.',
    sourcesCaption: 'مصادر بيانات الدولة',
    sourcesColumns: { item: 'البند', source: 'الرابط', verified: 'آخر تحقّق', status: 'الحالة' },
    neverVerified: 'لم يُتحقَّق منه',
    sourcesNone: 'لا توجد مصادر موثّقة لدولتك في هذا التقرير.',
    disclaimer: [
      'هذا التقرير أداة تخطيط مبنية على الأرقام التي أدخلتها وعلى افتراضات المحرك المذكورة في الملحق أ؛ وليس استشارة قانونية أو ضريبية أو مالية أو استثمارية.',
      'لا يضمن الحكم ولا أي رقم نتيجة المشروع في السوق؛ تُختبر الافتراضات بخطة التحقق قبل أن تنفق عليها.',
      'القيم القانونية والتنظيمية في التقرير منقولة من مصادر رسمية مؤرخة، وما كان قديمًا أو غير متحقَّق منه يحمل عبارة «تحقّق من المصدر الرسمي».',
    ],
    notAProbability: 'درجة الجدوى ونسبة المعايير المتحققة ليست احتمال نجاح.',
  },
  print: {
    fill: {
      success: 'حدّ النجاح (تضعه قبل أن تبدأ)',
      result: 'النتيجة',
      decision: 'القرار',
      go: 'أمضي',
      revise: 'أعدّل',
      stop: 'أتوقّف',
    },
    locked: 'قسم مقفل في هذا الملخص.',
  },
};
