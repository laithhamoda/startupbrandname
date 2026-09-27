import 'server-only';
import type { Axis } from '@sbn/question-bank';
import type { Localized, TitledText } from './types';

// The completeness weights come from the question bank, the one place the score is computed.
export { AXIS_WEIGHTS } from '@sbn/question-bank';

export type AxisLetter = Axis;

export interface MethodologyContent {
  heading: string;
  lead: string;
  /** ISO date of the last substantive change, for the Article structured data. */
  updated: string;
  axesHeading: string;
  axesLead: string;
  /** Label before an axis's share of the completeness score. */
  weightLabel: string;
  axes: readonly { letter: AxisLetter; name: string; covers: string }[];
  weightNote: string;
  rulesHeading: string;
  rulesLead: string;
  rules: readonly { trigger: string; response: string }[];
  provenanceHeading: string;
  provenanceLead: string;
  provenance: readonly TitledText[];
  confidence: string;
  verifyNote: string;
  engineHeading: string;
  engineLead: readonly string[];
  formulas: readonly { term: string; formula: string }[];
  engineNotes: readonly string[];
  verdictHeading: string;
  verdictLead: string;
  verdict: readonly { word: string; meaning: string }[];
  aiHeading: string;
  aiDoes: { title: string; items: readonly string[] };
  aiDoesNot: { title: string; items: readonly string[] };
  limitsHeading: string;
  limits: readonly string[];
}

export const METHODOLOGY: Localized<MethodologyContent> = {
  ar: {
    heading: 'المنهجية',
    lead: 'كيف نسأل، وكيف نقبل الإجابات، ومن أين يأتي كل رقم، وكيف نصل إلى الحكم. نكتبها هنا كاملة لأن الثقة بالنتيجة تبدأ من فهم الطريقة.',
    updated: '2026-09-27',
    axesHeading: 'ثمانية محاور، 64 سؤالًا',
    axesLead:
      'لكل محور ثمانية أسئلة، وتُضاف أسئلة متابعة حسب إجاباتك. النسخة السريعة تختار منها 20 سؤالًا أساسيًا.',
    weightLabel: 'الوزن في درجة الاكتمال',
    axes: [
      {
        letter: 'A',
        name: 'المؤسس والموارد',
        covers:
          'خبرتك ومهاراتك وفريقك، ورأس المال المتاح، والوقت الذي تخصّصه، والمدة التي تحتملها دون دخل.',
      },
      {
        letter: 'B',
        name: 'الفكرة والمشكلة',
        covers:
          'المشكلة التي تحلّها بالضبط، ومن يعاني منها، وكيف يتصرّف الناس اليوم من دونك، وما يمنع غيرك من نسخ فكرتك.',
      },
      {
        letter: 'C',
        name: 'العميل',
        covers: 'من يدفع لك، ووصف دقيق لعميلك الأول، ولحظة الشراء، وهل دفع أحد أو وعد بالدفع.',
      },
      {
        letter: 'D',
        name: 'السوق والدولة',
        covers:
          'النطاق الجغرافي، والقطاع، وثلاثة منافسين أو بدائل على الأقل بأسعارهم، والموسمية، والاعتماد على الاستيراد.',
      },
      {
        letter: 'E',
        name: 'العمليات',
        covers:
          'كيف يصل منتجك إلى العميل خطوة بخطوة، والأنشطة والأدوات والمورّدون، ومكان العمل، والطاقة الشهرية، والموظفون.',
      },
      {
        letter: 'F',
        name: 'الأرقام',
        covers:
          'سعر البيع، والتكلفة المتغيرة للوحدة، والتكاليف الثابتة الشهرية، وتكاليف التأسيس، والمبيعات المتوقعة، وطريقة الدفع، وعملة التقرير.',
      },
      {
        letter: 'G',
        name: 'الإطار القانوني',
        covers:
          'الشكل القانوني، والتسجيل والترخيص، وتوزيع الملكية بين الشركاء، والاسم التجاري، وتفضيل التمويل المتوافق مع الشريعة، والالتزامات الضريبية.',
      },
      {
        letter: 'H',
        name: 'الأهداف والقيود',
        covers:
          'معنى النجاح خلال 12 شهرًا، والمؤشّر الأسبوعي، ومصادر التمويل، والخطوط الحمراء، وأقصى مدة تقبلها للوصول إلى التعادل، ولمن سيُعرض التقرير.',
      },
    ],
    weightNote:
      'الوزن نصيب المحور من درجة الاكتمال، والدرجة تحدّد ما يمكن إصداره: لا شيء، أو ملخّص في صفحة واحدة، أو تقرير كامل.',
    rulesHeading: 'قواعد قبول الإجابات',
    rulesLead:
      'تُفحص كل إجابة بقواعد ثابتة. الرفض لا يأتي رسالة خطأ جافة، بل سؤالًا أسهل أو مثالًا، بنبرة حازمة غير جارحة.',
    rules: [
      {
        trigger: 'العميل هو «الجميع»',
        response: 'المشروع الذي يستهدف الجميع لا يصل إلى أحد. من أول 10 عملاء سيدفعون لك؟',
      },
      {
        trigger: '«لا منافسين»',
        response: 'كيف يتصرّف العميل اليوم من دونك؟ هذا هو منافسك.',
      },
      { trigger: 'نص في خانة رقمية', response: 'نعرض عليك نطاقًا مقترحًا تختار منه.' },
      {
        trigger: '«لا أعرف»',
        response: 'تُقبل الإجابة وتُحفظ افتراضًا منخفض الثقة، ويُنشأ لها اختبار في خطة التحقّق.',
      },
      {
        trigger: 'صفات مبهمة: أفضل، أسرع، جودة عالية',
        response: 'أفضل بكم؟ أسرع بكم يومًا أو ساعة؟ أعطني رقمًا.',
      },
      {
        trigger: 'تناقض بين إجابتين',
        response: 'نعرض الإجابتين جنبًا إلى جنب لتصحّح إحداهما.',
      },
      { trigger: 'إجابة أقصر من اللازم', response: 'نطلب مثالًا واحدًا حقيقيًا.' },
      {
        trigger: 'وصف الحل بدل المشكلة',
        response: 'هذا حلّك. ما الألم الذي يشعر به العميل قبل أن يعرفك؟',
      },
    ],
    provenanceHeading: 'مصدر كل معلومة',
    provenanceLead:
      'كل إجابة وكل رقم محسوب أو خارجي يحمل ثلاث علامات: مصدره، ودرجة الثقة به، وهل جرى التحقّق منه.',
    provenance: [
      { title: 'إجابتك', body: 'ما كتبته أنت في التشخيص.' },
      {
        title: 'افتراض',
        body: 'قيمة لم تُؤكَّد بعد، مثل إجابة «لا أعرف» أو مضاعِفات السيناريوهات. تظهر معلنة ليُختبر أثرها.',
      },
      {
        title: 'مصدر خارجي',
        body: 'معلومة من مصدر منشور، تُعرض مع رابطها وتاريخ الاطلاع عليها.',
      },
    ],
    confidence: 'ودرجة الثقة واحدة من ثلاث: عالية، أو متوسطة، أو منخفضة.',
    verifyNote:
      'القيم القانونية والضريبية لا تُكتب في الكود. تُحفظ مع مصدرها الرسمي وتاريخ آخر تحقّق منها، وتظهر بعلامة «تحقّق من المصدر الرسمي» إذا مضى على التحقّق أكثر من 90 يومًا أو كانت قيد المراجعة.',
    engineHeading: 'كيف تُحسب الأرقام',
    engineLead: [
      'الأرقام كلها تخرج من محرّك معادلات حتمي: المدخلات نفسها تعطي النتائج نفسها في كل مرة، ولكل معادلة اختبارات آلية تغطي حالاتها الحدّية.',
      'وحين تعدّل إجابة، يُعاد حساب ما يعتمد عليها وحده.',
    ],
    formulas: [
      {
        term: 'هامش المساهمة للوحدة (Contribution margin)',
        formula: 'سعر البيع − التكلفة المتغيرة للوحدة',
      },
      { term: 'نسبة هامش المساهمة', formula: 'هامش المساهمة ÷ سعر البيع' },
      {
        term: 'وحدات التعادل (Break-even)',
        formula: 'التكاليف الثابتة ÷ هامش المساهمة للوحدة، مقرّبة إلى الأعلى',
      },
      { term: 'إيراد التعادل', formula: 'التكاليف الثابتة ÷ نسبة هامش المساهمة' },
      {
        term: 'الحد الأدنى للسعر',
        formula: 'التكلفة المتغيرة للوحدة + التكاليف الثابتة ÷ متوسط المبيعات الشهرية المتوقعة',
      },
      {
        term: 'الحاجة إلى التمويل',
        formula: 'أكبر عجز يبلغه النقد المتراكم خلال فترة التوقعات',
      },
      {
        term: 'فترة الاسترداد',
        formula: 'تكاليف التأسيس ÷ متوسط صافي الربح الشهري بعد بلوغ التعادل',
      },
    ],
    engineNotes: [
      'إذا كانت التكلفة المتغيرة مساوية لسعر البيع أو أعلى منه، يتوقّف الحساب بتنبيه صريح: كل وحدة تبيعها تخسر فيها.',
      'في السيناريو المتحفّظ تنخفض المبيعات وترتفع التكاليف المتغيرة ويتأخّر الإطلاق، وفي المتفائل يحدث العكس. المضاعِفات قيم افتراضية معلنة في التقرير. ويُقاس أثر كل متغيّر رئيسي في ربح السنة الأولى، فيصبح أكثرها تأثيرًا أول تجربة في خطة التحقّق.',
    ],
    verdictHeading: 'الحكم: امضِ، أو عدّل، أو توقّف',
    verdictLead:
      'يختم الملخّص التنفيذي بحكم واحد صريح يستند إلى الأرقام المحسوبة وتنبيهاتها: هل يغطي السعر التكلفة؟ هل تكفي طاقتك لبلوغ التعادل؟ وهل تبلغه قبل أن تنفد قدرتك على الاستمرار دون دخل؟',
    verdict: [
      { word: 'امضِ', meaning: 'النموذج قابل للتنفيذ بصيغته الحالية.' },
      { word: 'عدّل', meaning: 'قابل للتنفيذ بعد تغييرات محدّدة يسمّيها التقرير.' },
      {
        word: 'توقّف',
        meaning: 'غير قابل للتنفيذ بصيغته الحالية، مع ثلاثة تغييرات محدّدة تقلب الحكم.',
      },
    ],
    aiHeading: 'دور الذكاء الاصطناعي',
    aiDoes: {
      title: 'ما يفعله',
      items: [
        'يفهم إجاباتك بلهجتك ويعيد صياغتها بالعربية الفصحى لتؤكّدها.',
        'يصنّف الإجابات ليكشف المبهم والمتناقض منها.',
        'يصوغ نصوص التقرير ويشرح الأرقام بعد حسابها.',
        'يدير حوار المرشد الذكي.',
      ],
    },
    aiDoesNot: {
      title: 'ما لا يفعله',
      items: [
        'لا يُنتج أي رقم يظهر في التقرير.',
        'لا يخترع أحجام أسواق أو إحصاءات أو أسماء شركات أو قوانين أو رسومًا. إذا لم نجد مصدرًا موثوقًا تركنا الحقل فارغًا وذكرنا السبب.',
        'لا يتلقّى اسمك أو بريدك أو رقم هاتفك: نحذفها قبل كل طلب، ونرسل محتوى المشروع وحده.',
      ],
    },
    limitsHeading: 'حدود المنصة',
    limits: [
      'المنصة أداة تخطيط، وليست استشارة قانونية أو مالية أو ضريبية. تحقّق من المتطلبات الرسمية مع الجهة المختصة أو مع مختص قبل أي التزام.',
      'الحكم تقدير لقابلية نموذجك للتنفيذ بناءً على إجاباتك، وليس ضمانًا لنتيجة.',
    ],
  },
  en: {
    heading: 'Methodology',
    lead: 'How we ask, how answers are accepted, where every number comes from and how the verdict is reached. We publish it in full because trust in a result starts with understanding the method.',
    updated: '2026-09-27',
    axesHeading: 'Eight axes, 64 questions',
    axesLead:
      'Each axis has eight questions, with follow-ups depending on your answers. The quick version picks 20 core questions from them.',
    weightLabel: 'Weight in the completeness score',
    axes: [
      {
        letter: 'A',
        name: 'Founder and resources',
        covers:
          'Your experience, skills and team, the capital you have, the time you can give, and how long you can go without income.',
      },
      {
        letter: 'B',
        name: 'Idea and problem',
        covers:
          'The exact problem you solve, who suffers from it most, how people cope today without you, and what stops others copying you.',
      },
      {
        letter: 'C',
        name: 'Customer',
        covers:
          'Who pays you, a precise description of your first customer, the moment they buy, and whether anyone has paid or promised to.',
      },
      {
        letter: 'D',
        name: 'Market and country',
        covers:
          'Geographic scope, sector, at least three competitors or alternatives with their prices, seasonality and reliance on imports.',
      },
      {
        letter: 'E',
        name: 'Operations',
        covers:
          'How your product reaches the customer step by step, key activities, tools and suppliers, where you work, monthly capacity and staff.',
      },
      {
        letter: 'F',
        name: 'Numbers',
        covers:
          'Selling price, variable cost per unit, monthly fixed costs, set-up costs, expected sales, how customers pay, and the report currency.',
      },
      {
        letter: 'G',
        name: 'Legal setup',
        covers:
          'Legal form, registration and licensing, ownership between partners, trade name, preference for Sharia-compliant finance, and tax obligations.',
      },
      {
        letter: 'H',
        name: 'Goals and limits',
        covers:
          'What success means in 12 months, the number you will watch weekly, funding sources, red lines, the longest acceptable time to break even, and who will read the report.',
      },
    ],
    weightNote:
      'The weight is the axis’s share of the completeness score, and the score decides what can be produced: nothing, a one-page summary or a full report.',
    rulesHeading: 'The rules answers must pass',
    rulesLead:
      'Every answer is checked against fixed rules. A rejection never arrives as a bare error message but as an easier question or an example, in a firm and respectful tone.',
    rules: [
      {
        trigger: 'The customer is “everyone”',
        response:
          'A project aimed at everyone reaches no one. Who are the first 10 customers who will pay you?',
      },
      {
        trigger: '“No competitors”',
        response: 'How does the customer manage today without you? That is your competitor.',
      },
      { trigger: 'Text in a number field', response: 'We suggest a range for you to choose from.' },
      {
        trigger: '“I don’t know”',
        response:
          'Accepted and saved as a low-confidence assumption, with a test added to the validation plan.',
      },
      {
        trigger: 'Vague words: better, faster, high quality',
        response: 'Better by how much? Faster by how many days or hours? Give me a number.',
      },
      {
        trigger: 'Two answers contradict each other',
        response: 'We show both side by side so you can correct one.',
      },
      { trigger: 'An answer that is too short', response: 'We ask for one real example.' },
      {
        trigger: 'The solution instead of the problem',
        response: 'That is your solution. What pain does the customer feel before they know you?',
      },
    ],
    provenanceHeading: 'Where every fact comes from',
    provenanceLead:
      'Every answer and every calculated or external value carries three tags: its source, how confident we are in it, and whether it has been validated.',
    provenance: [
      { title: 'Your answer', body: 'What you wrote in the diagnostic.' },
      {
        title: 'Assumption',
        body: 'A value not yet confirmed, such as an “I don’t know” answer or the scenario multipliers. It is shown openly so its effect can be tested.',
      },
      {
        title: 'External source',
        body: 'A fact from a published source, shown with its link and the date it was read.',
      },
    ],
    confidence: 'Confidence is one of three levels: high, medium or low.',
    verifyNote:
      'Legal and tax values are never written into the code. They are stored with their official source and the date they were last checked, and are marked “Check the official source” when that check is more than 90 days old or under review.',
    engineHeading: 'How the numbers are calculated',
    engineLead: [
      'Every number comes from a deterministic formula engine: the same inputs always give the same results, and each formula has automated tests for its edge cases.',
      'When you change an answer, only what depends on it is recalculated.',
    ],
    formulas: [
      { term: 'Contribution margin per unit', formula: 'selling price − variable cost per unit' },
      { term: 'Contribution margin ratio', formula: 'contribution margin ÷ selling price' },
      {
        term: 'Break-even units',
        formula: 'fixed costs ÷ contribution margin per unit, rounded up',
      },
      { term: 'Break-even revenue', formula: 'fixed costs ÷ contribution margin ratio' },
      {
        term: 'Price floor',
        formula: 'variable cost per unit + fixed costs ÷ average expected monthly sales',
      },
      {
        term: 'Funding need',
        formula: 'the deepest point of cumulative cash over the projection',
      },
      {
        term: 'Payback period',
        formula: 'set-up costs ÷ average monthly net profit after break-even',
      },
    ],
    engineNotes: [
      'If the variable cost equals or exceeds the selling price, the calculation stops with a clear warning: you lose money on every unit you sell.',
      'The conservative scenario lowers sales, raises variable costs and delays the launch; the optimistic one does the opposite. The multipliers are default assumptions shown in the report. The effect of each main variable on first-year profit is measured, and the most influential one becomes the first experiment in the validation plan.',
    ],
    verdictHeading: 'The verdict: go, revise or stop',
    verdictLead:
      'The executive summary ends with one plain verdict based on the calculated numbers and their warnings: does the price cover the cost, is your capacity enough to break even, and will you break even before you can no longer go without income?',
    verdict: [
      { word: 'Go', meaning: 'The model is viable in its current form.' },
      { word: 'Revise', meaning: 'Viable after specific changes that the report names.' },
      {
        word: 'Stop',
        meaning: 'Not viable in its current form, with three specific changes that would turn it.',
      },
    ],
    aiHeading: 'The role of AI',
    aiDoes: {
      title: 'What it does',
      items: [
        'Reads your answers in your dialect and restates them in Modern Standard Arabic for you to confirm.',
        'Classifies answers to catch vague or contradictory ones.',
        'Drafts the report’s text and explains the numbers once they are calculated.',
        'Runs the conversation with the AI mentor.',
      ],
    },
    aiDoesNot: {
      title: 'What it does not do',
      items: [
        'It produces no number that appears in the report.',
        'It invents no market sizes, statistics, company names, laws or fees. If we find no reliable source, we leave the field empty and say why.',
        'It never receives your name, email or phone number: we remove them before every request and send the project content only.',
      ],
    },
    limitsHeading: 'Limits',
    limits: [
      'The platform is a planning tool, not legal, financial or tax advice. Check official requirements with the relevant authority or a professional before you commit to anything.',
      'The verdict is an assessment of your model’s viability based on your answers, not a guarantee of any outcome.',
    ],
  },
};
