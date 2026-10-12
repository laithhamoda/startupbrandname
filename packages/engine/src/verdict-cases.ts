import { flatAnswers, flatProvenance, FLAT_CONTEXT, jodItems, real } from './flat-vector';
import { moneyTo, type CriterionRow, type GoldenProject } from './golden-projects';

/*
 * The four synthetic projects of the owner review page (D-247): a clearly good project, one just
 * under the line, one with a negative margin and one whose funding need is above twice its capital
 * with no outside source. They are built on the flat vector of the engine's own fixtures (400 units
 * a month at 10, a variable cost of 4 and fixed costs of 1,000, set-up costs of 3,000 and capital of
 * 5,000 to 8,000 JOD, before tax) and have no golden file: they exist so the owner can see each
 * verdict next to its hand computation. Nothing here is market data; the wording of the questions is
 * not final (OPEN-QUESTIONS 86).
 */

/** Two competitors at 11 and 14 dinars: the market band that a suggested price is read against (D-260). */
const COMPETITORS = real({
  items: [
    { name: 'منافس أ', price: { amount: 11, currency: 'JOD' } },
    { name: 'منافس ب', price: { amount: 14, currency: 'JOD' } },
  ],
});

const SAMPLE_NOTE = 'مشروع اصطناعي مبني على أرقام الاختبار المسطّحة وليس مشروعًا حقيقيًا.';

const CONFIDENCE_ALL_HIGH =
  'الأرقام المحورية الخمسة كلها بثقة عالية: 5 من 5 = 100%، وهو 75% فأكثر: عالية';

/** The criteria all four cases share when the margin is 6 and the break-even is in month 1. */
const SHARED = {
  margin: { id: 'margin_positive', status: 'pass', hand: '10 − 4 = 6 د.أ، وهو موجب' },
  window: {
    id: 'break_even_within_window',
    status: 'pass',
    hand: 'التعادل في الشهر 1 (ربحه 400 × 6 − 1,000 = 1,400 د.أ)، وهو ضمن 36 شهرًا',
  },
  target: {
    id: 'break_even_within_target',
    status: 'pass',
    hand: 'الشهر 1 ضمن أطول مدة قبلها المؤسس (H5: 12 شهرًا)',
  },
  runway: {
    id: 'break_even_within_runway',
    status: 'pass',
    hand: 'الشهر 1 ضمن المدة التي يتحمّلها المؤسس بلا دخل (A7: من 3 إلى 6 أشهر)',
  },
  floor: {
    id: 'price_above_floor',
    status: 'pass',
    hand: 'السعر 10 د.أ فوق سعر الحدّ الأدنى (4 + 1,000 ÷ 400 = 6.5 د.أ)',
  },
  ltv: {
    id: 'ltv_cac_at_minimum',
    status: 'not_evaluated',
    hand: 'ليس اشتراكًا، فلا LTV ولا CAC',
  },
  conservative: {
    id: 'conservative_break_even',
    status: 'pass',
    hand: 'في السيناريو المتحفّظ تخلو الأشهر الثلاثة الأولى من المبيعات، ثم 240 وحدة × (10 − 4.4) − 1,000 = 344 د.أ: التعادل في الشهر 4',
  },
  units: {
    id: 'break_even_units_within_capacity',
    status: 'pass',
    hand: 'نقطة التعادل 1,000 ÷ 6 = 166.67 فتُقرَّب إلى 167 وحدة، ضمن الطاقة القصوى (E7: 500 وحدة)',
  },
} satisfies Record<string, CriterionRow>;

const good: GoldenProject = {
  name: 'case-good',
  title: 'مشروع جيد: كل المعايير المقيَّمة متحققة',
  sentence: `يبيع 400 وحدة كل شهر بسعر 10 د.أ وتكلفة متغيرة 4 د.أ، وتكاليفه الثابتة 1,000 د.أ شهريًا وتأسيسه 3,000 د.أ، ورأس ماله المتاح من 5,000 إلى 8,000 د.أ، ويموّله بمدخراته. ${SAMPLE_NOTE}`,
  currencyLabel: 'د.أ',
  context: FLAT_CONTEXT,
  answers: flatAnswers(),
  provenance: flatProvenance(),
  tax: { rules: [] },
  rows: [],
  paymentVariants: [],
  decision: {
    criteria: [
      SHARED.margin,
      SHARED.window,
      SHARED.target,
      SHARED.runway,
      {
        id: 'funding_within_capital',
        status: 'pass',
        hand: 'الربح 1,400 د.أ شهريًا من الشهر 1، فأدنى رصيد هو التأسيس −3,000 د.أ، وهو ضمن أقصى رأس مال (8,000 د.أ)',
      },
      {
        id: 'setup_within_capital',
        status: 'pass',
        hand: 'تكاليف التأسيس 3,000 د.أ ضمن أقصى رأس مال متاح (8,000 د.أ)',
      },
      SHARED.floor,
      SHARED.ltv,
      SHARED.conservative,
      {
        id: 'payback_within_window',
        status: 'pass',
        hand: 'الرصيد بعد الأشهر 0 و1 و2 و3: −3,000 و−1,600 و−200 و+1,200، فالاسترداد بعد 3 أشهر',
      },
      SHARED.units,
    ],
    evaluated: 10,
    passed: 10,
    blockers: [],
    verdict: 'go',
    confidence: 'high',
    sound: 5,
    plan: ['worry', 'price', 'sales'],
    scoreHand:
      'المعايير المقيَّمة 10 (معيار LTV ÷ CAC خارج العدّ)؛ المتحقق منها 10، فالدرجة 10 ÷ 10 = 100%',
    blockersHand:
      'لا حاجب: الهامش 6 د.أ موجب، والتعادل في الشهر 1، واحتياج التمويل 3,000 د.أ أقل بكثير من ضعف أقصى رأس مال (2 × 8,000 = 16,000 د.أ)',
    verdictHand:
      'الدرجة 100% فوق 75% ولا حاجب والثقة الإجمالية عالية: القرار امضِ. وبالأرقام نفسها وثقة منخفضة في ثلاثة من الأرقام الخمسة يصير القرار عدّل (يغطيه اختبار في المحرّك)',
    changes: [],
    rethink: [],
    rethinkHand: 'القرار امضِ: لا تغيير مطلوب',
    confidenceHand: CONFIDENCE_ALL_HIGH,
    planHand:
      'قلق المؤسس (H6) أولًا. السعر 1 × 4 = 4، والمبيعات 1 × 3 = 3، والتكلفة المتغيرة 1 × 2 = 2، والتكاليف الثابتة 1 × 1 = 1؛ فيدخل السعر ثم المبيعات',
  },
};

const borderline: GoldenProject = {
  name: 'case-borderline',
  title: 'مشروع على الحدّ: معيار واحد دون خط 75%',
  sentence: `المشروع الجيد نفسه بسعر 8 د.أ وتكاليف تأسيس 9,000 د.أ، أي فوق أقصى رأس مال متاح (8,000 د.أ)، وأسعار منافسيه 11 و14 د.أ. ${SAMPLE_NOTE}`,
  currencyLabel: 'د.أ',
  context: FLAT_CONTEXT,
  answers: flatAnswers({
    F1: real({ amount: 8, currency: 'JOD' }),
    F5: real(jodItems(['تأسيس', 9000])),
    D4: COMPETITORS,
  }),
  provenance: flatProvenance(),
  tax: { rules: [] },
  rows: [],
  paymentVariants: [],
  decision: {
    criteria: [
      { id: 'margin_positive', status: 'pass', hand: '8 − 4 = 4 د.أ، وهو موجب' },
      {
        id: 'break_even_within_window',
        status: 'pass',
        hand: 'التعادل في الشهر 1 (ربحه 400 × 4 − 1,000 = 600 د.أ)، وهو ضمن 36 شهرًا',
      },
      SHARED.target,
      SHARED.runway,
      {
        id: 'funding_within_capital',
        status: 'fail',
        hand: 'أدنى رصيد هو التأسيس −9,000 د.أ في الشهر 0، أعلى من أقصى رأس مال متاح (8,000 د.أ)',
      },
      {
        id: 'setup_within_capital',
        status: 'fail',
        hand: 'تكاليف التأسيس 9,000 د.أ أعلى من أقصى رأس مال متاح (8,000 د.أ)',
      },
      {
        id: 'price_above_floor',
        status: 'pass',
        hand: 'السعر 8 د.أ فوق سعر الحدّ الأدنى (4 + 1,000 ÷ 400 = 6.5 د.أ)',
      },
      SHARED.ltv,
      {
        id: 'conservative_break_even',
        status: 'fail',
        hand: 'في السيناريو المتحفّظ: 240 وحدة × (8 − 4.4) − 1,000 = −136 د.أ كل شهر، فلا يوجد تعادل',
      },
      {
        id: 'payback_within_window',
        status: 'pass',
        hand: '−9,000 + 600 × 15 = 0: الرصيد يعود إلى الصفر بعد 15 شهرًا، وهو ضمن 36 شهرًا',
      },
      {
        id: 'break_even_units_within_capacity',
        status: 'pass',
        hand: 'نقطة التعادل 1,000 ÷ 4 = 250 وحدة، ضمن الطاقة القصوى (E7: 500 وحدة)',
      },
    ],
    evaluated: 10,
    passed: 7,
    blockers: [],
    verdict: 'revise',
    confidence: 'high',
    sound: 5,
    plan: ['worry', 'price', 'vc'],
    scoreHand:
      'المعايير المقيَّمة 10؛ المتحقق منها 7، فالدرجة 7 ÷ 10 = 70%، دون خط 75%. ومعيار واحد إضافي يرفعها إلى 80%',
    blockersHand:
      'لا حاجب: الهامش 4 د.أ موجب، والتعادل في الشهر 1، واحتياج التمويل 9,000 د.أ أقل من ضعف أقصى رأس مال (2 × 8,000 = 16,000 د.أ)',
    verdictHand: 'الدرجة 70% أقل من 75% ولا حاجب: القرار عدّل',
    changes: [
      {
        levers: ['price'],
        to: [moneyTo(8_567n)],
        premium: false,
        reachesThreshold: true,
        passed: 8,
        evaluated: 10,
        verdict: 'go',
        hand: 'في السيناريو المتحفّظ 240 وحدة × (السعر − 4.4) − 1,000 ≥ 0 يعطي السعر ≥ 8.5667، والأقل بثلاث خانات عشرية هو 8.567 د.أ: 240 × 4.167 − 1,000 = 0.08 د.أ. الزيادة +7.09%. فيتحقق معيار السيناريو المتحفّظ وحده فيصير 8 من 10 = 80%: امضِ',
      },
      {
        levers: ['setup_costs'],
        to: [moneyTo(8_000_000n)],
        premium: false,
        reachesThreshold: true,
        passed: 9,
        evaluated: 10,
        verdict: 'go',
        hand: 'تكاليف التأسيس 8,000 د.أ تساوي أقصى رأس مال (8,000 د.أ) فيتحقق معياران معًا: التأسيس ضمن رأس المال، واحتياج التمويل (وهو التأسيس نفسه في الشهر 0) ضمنه. التخفيض −1,000 ÷ 9,000 = −11.11%. فيصير 9 من 10 = 90%: امضِ',
      },
      {
        levers: ['variable_cost'],
        to: [moneyTo(3_484n)],
        premium: false,
        reachesThreshold: true,
        passed: 8,
        evaluated: 10,
        verdict: 'go',
        hand: 'في السيناريو المتحفّظ 240 × (8 − 1.1 × التكلفة) − 1,000 ≥ 0 يعطي التكلفة ≤ 3.4848، والأعلى بثلاث خانات عشرية هو 3.484 د.أ: 240 × (8 − 3.8324) − 1,000 = 0.224 د.أ، أما 3.485 فتعطي 240 × (8 − 3.8335) − 1,000 = −0.04 د.أ. التخفيض −12.9%. فيصير 8 من 10 = 80%: امضِ',
      },
    ],
    rethink: [],
    rethinkHand: 'ثلاثة تغييرات تغيّر القرار، فلا حاجة إلى قائمة «أعِد التفكير»',
    confidenceHand: CONFIDENCE_ALL_HIGH,
    planHand:
      'قلق المؤسس (H6) أولًا. تتعادل التكلفة المتغيرة والمبيعات في حساسيتهما (7,680 د.أ لكل منهما)، فيبقى الترتيب السعر ثم التكلفة المتغيرة ثم المبيعات ثم التكاليف الثابتة: السعر 1 × 4 = 4، والتكلفة المتغيرة 1 × 3 = 3، والمبيعات 1 × 2 = 2، والتكاليف الثابتة 1 × 1 = 1',
  },
};

const negativeMargin: GoldenProject = {
  name: 'case-negative-margin',
  title: 'مشروع هامشه سالب: يخسر على كل وحدة',
  sentence: `تكلفة الوحدة المتغيرة 12 د.أ وسعرها 10 د.أ، فيخسر المشروع 2 د.أ على كل وحدة تُباع، وتمويله من قرض، وأسعار منافسيه 11 و14 د.أ. ${SAMPLE_NOTE}`,
  currencyLabel: 'د.أ',
  context: FLAT_CONTEXT,
  answers: flatAnswers({
    F3: real(jodItems(['مواد', 12])),
    H3: real({ values: ['loan'] }),
    D4: COMPETITORS,
  }),
  provenance: flatProvenance(),
  tax: { rules: [] },
  rows: [],
  paymentVariants: [],
  decision: {
    criteria: [
      {
        id: 'margin_positive',
        status: 'fail',
        hand: '10 − 12 = −2 د.أ، وهو ليس موجبًا',
      },
      {
        id: 'break_even_within_window',
        status: 'fail',
        hand: 'يخسر المشروع 400 × 2 + 1,000 = 1,800 د.أ كل شهر، ولا يصل إلى التعادل في أي شهر',
      },
      {
        id: 'break_even_within_target',
        status: 'fail',
        hand: 'لا تعادل في أي شهر، فلا يتحقق ضمن أطول مدة قبلها المؤسس (H5: 12 شهرًا)',
      },
      {
        id: 'break_even_within_runway',
        status: 'fail',
        hand: 'لا تعادل في أي شهر، فلا يتحقق ضمن المدة التي يتحمّلها بلا دخل (A7: من 3 إلى 6 أشهر)',
      },
      {
        id: 'funding_within_capital',
        status: 'fail',
        hand: 'التأسيس 3,000 + 36 × 1,800 = 67,800 د.أ، أعلى من أقصى رأس مال متاح (8,000 د.أ)',
      },
      {
        id: 'setup_within_capital',
        status: 'pass',
        hand: 'تكاليف التأسيس 3,000 د.أ ضمن أقصى رأس مال متاح (8,000 د.أ)',
      },
      {
        id: 'price_above_floor',
        status: 'fail',
        hand: 'سعر الحدّ الأدنى 12 + 1,000 ÷ 400 = 14.5 د.أ، والسعر 10 د.أ أقل منه',
      },
      SHARED.ltv,
      {
        id: 'conservative_break_even',
        status: 'fail',
        hand: 'التكلفة المتغيرة × 1.1 = 13.2 د.أ والمبيعات × 0.6: الخسارة أكبر ولا يوجد تعادل',
      },
      {
        id: 'payback_within_window',
        status: 'fail',
        hand: 'الرصيد ينخفض كل شهر ولا يعود إلى الصفر',
      },
      {
        id: 'break_even_units_within_capacity',
        status: 'fail',
        hand: 'لا يوجد عدد من الوحدات يغطي التكاليف بهامش سالب، فلا تعادل ضمن الطاقة القصوى (E7: 500 وحدة)',
      },
    ],
    evaluated: 10,
    passed: 1,
    blockers: ['margin_not_positive'],
    verdict: 'stop',
    confidence: 'high',
    sound: 5,
    plan: ['worry', 'vc', 'price'],
    scoreHand: 'المعايير المقيَّمة 10؛ المتحقق منها 1 (تكاليف التأسيس)، فالدرجة 1 ÷ 10 = 10%',
    blockersHand:
      'حاجب واحد: الهامش −2 د.أ ليس موجبًا. ولا يُعدّ «لا تعادل» حاجبًا ثانيًا لأن الهامش هو سببه',
    verdictHand: 'حاجب واحد يوقف المشروع مهما كانت الدرجة: القرار توقّف',
    changes: [
      {
        levers: ['variable_cost'],
        to: [moneyTo(7_500n)],
        premium: false,
        reachesThreshold: true,
        passed: 8,
        evaluated: 10,
        verdict: 'go',
        hand: 'الربح الشهري 400 × (10 − التكلفة) − 1,000 يجب ألا يقل عن صفر: التكلفة 7.5 د.أ تعطي 400 × 2.5 − 1,000 = 0، وهو أول شهر غير سالب، أما 7.501 فتعطي −0.4 د.أ فلا تعادل. التخفيض −37.5%. فيصير 8 من 10 = 80% ولا حاجب: امضِ',
      },
      {
        levers: ['price', 'variable_cost'],
        to: [moneyTo(12_100n), moneyTo(9_480n)],
        premium: false,
        reachesThreshold: true,
        passed: 8,
        evaluated: 10,
        verdict: 'go',
        hand: 'يتحرك السعر والتكلفة بالنسبة نفسها t: 10 × (1 + t) − 12 × (1 − t) ≥ 2.5 (لأن 1,000 ÷ 400 = 2.5) يعطي 22 t ≥ 4.5 أي t ≥ 20.45%، وأصغر نسبة صحيحة هي 21%: السعر 12.1 والتكلفة 9.48 د.أ فيربح 400 × 2.62 − 1,000 = 48 د.أ شهريًا. المجموع 21% + 21% = 42%. فيصير 8 من 10 = 80% ولا حاجب: امضِ',
      },
      {
        levers: ['price'],
        to: [moneyTo(14_500n)],
        premium: true,
        reachesThreshold: true,
        passed: 8,
        evaluated: 10,
        verdict: 'go',
        hand: 'الربح الشهري 400 × (السعر − 12) − 1,000 ≥ 0 يعطي السعر ≥ 14.5 د.أ، وهو 400 × 2.5 − 1,000 = 0. الزيادة +45%. والسعر 14.5 أعلى من أعلى منافس معروف (14 د.أ)، فهو سعر مميَّز (Premium). فيصير 8 من 10 = 80% ولا حاجب: امضِ',
      },
    ],
    rethink: [],
    rethinkHand: 'ثلاثة تغييرات تغيّر القرار، فلا حاجة إلى قائمة «أعِد التفكير»',
    confidenceHand: CONFIDENCE_ALL_HIGH,
    planHand:
      'قلق المؤسس (H6) أولًا. الحساسية الآن أعلى ما تكون للتكلفة المتغيرة (ترتيب 1): التكلفة المتغيرة 1 × 4 = 4، ثم السعر 1 × 3 = 3، والتكاليف الثابتة 1 × 2 = 2، والمبيعات 1 × 1 = 1',
  },
};

const fundingGap: GoldenProject = {
  name: 'case-funding-gap',
  title: 'تمويل يفوق ضعف رأس المال بلا مصدر خارجي',
  sentence: `المشروع الجيد نفسه بتكاليف تأسيس 17,000 د.أ ورأس مال أقصاه 8,000 د.أ، ويموّله صاحبه بمدخراته وبمال العائلة فقط. ${SAMPLE_NOTE}`,
  currencyLabel: 'د.أ',
  context: FLAT_CONTEXT,
  answers: flatAnswers({
    F5: real(jodItems(['تأسيس', 17000])),
    H3: real({ values: ['self', 'family'] }),
  }),
  provenance: flatProvenance(),
  tax: { rules: [] },
  rows: [],
  paymentVariants: [],
  decision: {
    criteria: [
      SHARED.margin,
      SHARED.window,
      SHARED.target,
      SHARED.runway,
      {
        id: 'funding_within_capital',
        status: 'fail',
        hand: 'أدنى رصيد هو التأسيس −17,000 د.أ في الشهر 0، أعلى من أقصى رأس مال متاح (8,000 د.أ)',
      },
      {
        id: 'setup_within_capital',
        status: 'fail',
        hand: 'تكاليف التأسيس 17,000 د.أ أعلى من أقصى رأس مال متاح (8,000 د.أ)',
      },
      SHARED.floor,
      SHARED.ltv,
      SHARED.conservative,
      {
        id: 'payback_within_window',
        status: 'pass',
        hand: '−17,000 + 1,400 × 13 = 1,200: الرصيد يعود إلى الصفر أو أكثر بعد 13 شهرًا، وهو ضمن 36 شهرًا',
      },
      SHARED.units,
    ],
    evaluated: 10,
    passed: 8,
    blockers: ['funding_need_above_capital_multiple'],
    verdict: 'stop',
    confidence: 'high',
    sound: 5,
    plan: ['worry', 'price', 'sales'],
    scoreHand: 'المعايير المقيَّمة 10؛ المتحقق منها 8، فالدرجة 8 ÷ 10 = 80%، وهي فوق 75%',
    blockersHand:
      'حاجب واحد: احتياج التمويل 17,000 د.أ أعلى من ضعف أقصى رأس مال (2 × 8,000 = 16,000 د.أ) و H3 لا يذكر غير المدخرات والعائلة. ولو ذكر قرضًا أو مستثمرًا أو منحة أو جائزة لما كان حاجبًا، ولو كان احتياج التمويل 16,000 د.أ بالضبط لما كان حاجبًا',
    verdictHand: 'الدرجة 80% كافية للمضي، لكن الحاجب يوقف المشروع مهما كانت الدرجة: القرار توقّف',
    changes: [
      {
        levers: ['setup_costs'],
        to: [moneyTo(16_000_000n)],
        premium: false,
        reachesThreshold: true,
        passed: 8,
        evaluated: 10,
        verdict: 'go',
        hand: 'ضعف أقصى رأس مال 2 × 8,000 = 16,000 د.أ: احتياج التمويل (وهو التأسيس نفسه في الشهر 0) يساوي ضعف رأس المال ولا يزيد عليه فيزول الحاجب، وبزيادة وحدة صغرى واحدة يعود. التخفيض −1,000 ÷ 17,000 = −5.88%. وتبقى المعايير المتحققة 8 من 10 = 80%، وهي فوق 75% ولا حاجب: امضِ',
      },
    ],
    rethink: ['price', 'sales'],
    rethinkHand:
      'لا رافعة غير التأسيس تزيل الحاجب، فتُملأ الخانتان الباقيتان بأكبر متغيّرين في مخطط الحساسية: السعر (19,200 د.أ) ثم المبيعات (11,520 د.أ). 4,800 وحدة في السنة × 10 د.أ × 20% × 2 = 19,200، و4,800 × 20% × 2 × 6 = 11,520. ولا قيمة مقترحة لهما',
    confidenceHand: CONFIDENCE_ALL_HIGH,
    planHand:
      'قلق المؤسس (H6) أولًا. السعر 1 × 4 = 4، والمبيعات 1 × 3 = 3، والتكلفة المتغيرة 1 × 2 = 2، والتكاليف الثابتة 1 × 1 = 1؛ فيدخل السعر ثم المبيعات',
  },
};

/** The four synthetic cases of the review page, in the order good, borderline, negative margin, funding gap. */
export const VERDICT_CASES: readonly GoldenProject[] = [
  good,
  borderline,
  negativeMargin,
  fundingGap,
];
