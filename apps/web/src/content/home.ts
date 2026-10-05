import 'server-only';
import type { Localized, TitledText } from './types';

export interface HomeContent {
  heading: string;
  lead: string;
  status: string;
  start: string;
  secondary: string;
  verdictLabel: string;
  verdict: readonly { word: string; meaning: string }[];
  stepsHeading: string;
  steps: readonly TitledText[];
  whyHeading: string;
  whyLead: string;
  why: readonly TitledText[];
  /** Text around the lowest weekly price, which is rendered from the plan table. */
  priceBefore: string;
  priceAfter: string;
  comparePlans: string;
  course: string;
  courseLink: string;
  closingHeading: string;
  closingBody: string;
  closingAction: string;
}

export const HOME: Localized<HomeContent> = {
  ar: {
    heading: 'حوّل فكرتك إلى نموذج عمل بأرقام محسوبة، لا مكتوبة',
    lead: 'تشخيص منظّم لفكرة مشروعك، وأرقام يحسبها محرّك معادلات لا نموذج لغوي، وتقرير عربي ينتهي بحكم واضح: امضِ، أو عدّل، أو توقّف.',
    status:
      'نبني المنصة على مراحل: إنشاء الحساب متاح الآن مجانًا، ويُطلق التشخيص ثم التقرير تباعًا.',
    start: 'ابدأ مجانًا',
    secondary: 'كيف تعمل المنصة',
    verdictLabel: 'الحكم في كل تقرير',
    verdict: [
      { word: 'امضِ', meaning: 'النموذج قابل للتنفيذ بصيغته الحالية.' },
      { word: 'عدّل', meaning: 'قابل للتنفيذ بعد تغييرات محدّدة يسمّيها التقرير.' },
      {
        word: 'توقّف',
        meaning: 'غير قابل للتنفيذ بصيغته الحالية، مع ثلاثة تغييرات محدّدة تقلب الحكم.',
      },
    ],
    stepsHeading: 'ثلاث مراحل من الفكرة إلى القرار',
    steps: [
      {
        title: 'التشخيص',
        body: 'أسئلة موزّعة على ثمانية محاور، من المؤسس والفكرة إلى الأرقام والإطار القانوني. النسخة السريعة 20 سؤالًا، والكاملة 64 سؤالًا مع أسئلة متابعة.',
      },
      {
        title: 'الحساب',
        body: 'التسعير، ونقطة التعادل (Break-even)، والتوقعات المالية لثلاث سنوات، والسيناريوهات، بمعادلات ثابتة ومختبرة.',
      },
      {
        title: 'التقرير',
        body: 'تقرير عربي قابل للتصدير يبدأ بالحكم، ويذكر مصدر كل رقم، وينتهي بخطة تحقّق لمدة 30 يومًا.',
      },
    ],
    whyHeading: 'لماذا لا تكتفي بروبوت محادثة عام؟',
    whyLead:
      'روبوت المحادثة يجيب عمّا تسأله. هنا تمرّ فكرتك بمسار كامل، وتخرج بأرقام تستطيع مراجعتها.',
    why: [
      {
        title: 'مسار إلزامي',
        body: 'لا قفز إلى النتيجة. الأسئلة مرتّبة، والإجابة المبهمة تُقابَل بسؤال أوضح أو بمثال.',
      },
      {
        title: 'أرقام محسوبة',
        body: 'الذكاء الاصطناعي لا يكتب أي رقم في تقريرك. الأرقام تخرج من معادلات مختبرة، وهو يشرحها فقط.',
      },
      {
        title: 'مصادر مؤرّخة',
        body: 'كل معلومة موسومة بمصدرها: إجابتك، أو افتراض، أو مصدر خارجي برابطه وتاريخ الاطلاع عليه.',
      },
      {
        title: 'مشاريع محفوظة',
        body: 'مشروعك يبقى في حسابك. عدّل إجابة واحدة فيُعاد حساب ما يعتمد عليها وحده.',
      },
    ],
    priceBefore: 'الخطط المدفوعة تبدأ من',
    priceAfter: 'لأسبوع كامل.',
    comparePlans: 'قارن الخطط',
    course: 'متدرّب في دورة «الذكاء الاصطناعي في ريادة الأعمال»؟ لك 12 شهرًا مجانًا بكود VIVA.',
    courseLink: 'تفاصيل كود الدورة',
    closingHeading: 'اختبر فكرتك قبل أن يختبرها السوق',
    closingBody: 'إنشاء الحساب مجاني، ولا يحتاج إلى بطاقة دفع.',
    closingAction: 'أنشئ حسابك',
  },
  en: {
    heading: 'Turn your idea into a business model with numbers that are calculated, not written',
    lead: 'A structured diagnostic of your business idea, numbers computed by a formula engine rather than a language model, and an Arabic report that ends with a clear verdict: go, revise or stop.',
    status:
      'We are building the platform in stages: you can create a free account now, and the diagnostic and then the report follow.',
    start: 'Start for free',
    secondary: 'How it works',
    verdictLabel: 'The verdict in every report',
    verdict: [
      { word: 'Go', meaning: 'The model is viable in its current form.' },
      { word: 'Revise', meaning: 'Viable after specific changes that the report names.' },
      {
        word: 'Stop',
        meaning: 'Not viable in its current form, with three specific changes that would turn it.',
      },
    ],
    stepsHeading: 'Three stages from idea to decision',
    steps: [
      {
        title: 'Diagnostic',
        body: 'Questions across eight axes, from the founder and the idea to the numbers and the legal setup. The quick version has 20 questions; the full one has 64 plus follow-ups.',
      },
      {
        title: 'Calculation',
        body: 'Pricing, the break-even point, a three-year financial projection and scenarios, from fixed, tested formulas.',
      },
      {
        title: 'Report',
        body: 'An exportable Arabic report that opens with the verdict, names the source of every number and ends with a 30-day validation plan.',
      },
    ],
    whyHeading: 'Why not just ask a general chatbot?',
    whyLead:
      'A chatbot answers what you ask. Here your idea goes through a complete path, and you come out with numbers you can check.',
    why: [
      {
        title: 'A set path',
        body: 'No jumping to the answer. Questions come in order, and a vague answer is met with a clearer question or an example.',
      },
      {
        title: 'Calculated numbers',
        body: 'AI writes no number in your report. Numbers come from tested formulas; AI only explains them.',
      },
      {
        title: 'Dated sources',
        body: 'Every fact is tagged with its source: your answer, an assumption, or an external source with its link and the date it was read.',
      },
      {
        title: 'Saved projects',
        body: 'Your project stays in your account. Change one answer and only what depends on it is recalculated.',
      },
    ],
    priceBefore: 'Paid plans start at',
    priceAfter: 'for a full week.',
    comparePlans: 'Compare plans',
    course:
      'A trainee on the “AI in Entrepreneurship” course? You get 12 months free with a VIVA code.',
    courseLink: 'About course codes',
    closingHeading: 'Test your idea before the market does',
    closingBody: 'Creating an account is free and needs no payment card.',
    closingAction: 'Create your account',
  },
};
