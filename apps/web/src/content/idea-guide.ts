import 'server-only';
import type { Localized } from './types';

interface GuideStep {
  id: string;
  title: string;
  body: string;
}

export interface IdeaGuideContent {
  heading: string;
  lead: string;
  /** "Last updated" label, then the ISO date also sent as dateModified. */
  updatedLabel: string;
  stepsHeading: string;
  steps: readonly GuideStep[];
  formulasHeading: string;
  formulasLead: string;
  formulas: readonly { id: string; name: string; formula: string }[];
  exampleHeading: string;
  example: readonly string[];
  exampleNote: string;
  mistakesHeading: string;
  mistakes: readonly { title: string; body: string }[];
  toolHeading: string;
  helps: readonly string[];
  helpsLabel: string;
  limits: readonly string[];
  limitsLabel: string;
  faqHeading: string;
  faq: readonly { id: string; question: string; answer: string }[];
  start: string;
  sample: string;
  questions: string;
  method: string;
}

/** Date of the last edit of the guide's text; change it whenever the text changes (D-306). */
export const IDEA_GUIDE_UPDATED = '2026-10-25';

/**
 * The public guide «how to test a business idea». General knowledge that any founder can use, with
 * no question wording, rule, weight or threshold of the diagnostic. The example numbers are made
 * up for the explanation and say so, with an explicit currency (CLAUDE.md §3). Arabic is the
 * reference; the English version has the same shape (idea-guide.test.ts).
 */
export const IDEA_GUIDE: Localized<IdeaGuideContent> = {
  ar: {
    heading: 'كيف تختبر فكرة مشروعك قبل أن تنفق عليها',
    lead: 'اختبر ثلاثة أشياء بالترتيب: هل المشكلة حقيقية ويدفع الناس لحلّها، وهل يغطّي السعر تكاليفك، وهل تصل إلى العملاء بتكلفة تتحمّلها. ثم اتخذ قرارًا واضحًا: امضِ أو عدّل أو توقّف. الخطوات السبع أدناه تقودك إلى ذلك دون أن تبني شيئًا بعد.',
    updatedLabel: 'آخر تحديث',
    stepsHeading: 'سبع خطوات من الفكرة إلى القرار',
    steps: [
      {
        id: 'sentence',
        title: 'اكتب الفكرة في جملة واحدة',
        body: 'من هو عميلك؟ ما المشكلة التي يعيشها؟ ما الذي ستقدّمه له؟ وبكم؟ إن لم تستطع قول ذلك في جملة واحدة فالفكرة لم تتحدد بعد، وأي اختبار بعدها سيقيس شيئًا غامضًا.',
      },
      {
        id: 'problem',
        title: 'تحقّق من أن المشكلة حقيقية',
        body: 'تحدّث مع عملاء محتملين عمّا فعلوه فعلًا في آخر مرة واجهوا فيها المشكلة: كيف حلّوها، وكم دفعوا، وما الذي أزعجهم. سلوكهم السابق أصدق من رأيهم في فكرتك، ومن مجاملة الأصدقاء والأقارب.',
      },
      {
        id: 'pay',
        title: 'اختبر الاستعداد للدفع',
        body: 'قبل أن تبني، اعرض السعر على أشخاص حقيقيين واطلب التزامًا صغيرًا: حجزًا، أو دفعة مقدّمة، أو تسجيلًا بالاسم في قائمة انتظار. عبارة «أعجبتني الفكرة» ليست التزامًا.',
      },
      {
        id: 'numbers',
        title: 'احسب الاقتصاد على وحدة واحدة',
        body: 'ابدأ بسعر البيع والتكلفة المتغيرة لكل وحدة، ثم أضف التكاليف الثابتة الشهرية. الفرق بين السعر والتكلفة المتغيرة هو هامش المساهمة (Contribution margin)، وهو ما يغطّي التكاليف الثابتة أولًا ثم يصير ربحًا.',
      },
      {
        id: 'channel',
        title: 'قدّر تكلفة الوصول إلى العميل',
        body: 'جرّب قناة واحدة بميزانية صغيرة، وقِس تكلفة اكتساب العميل (Customer acquisition cost). إن كان العميل يكلّفك للوصول إليه أكثر مما يتركه لك من هامش على مدى تعامله معك، فالنموذج لا يعمل بهذه القناة ولو نمت المبيعات.',
      },
      {
        id: 'limits',
        title: 'افحص القيود',
        body: 'الترخيص والضرائب والمتطلبات القانونية في بلدك، ومواردك الفعلية: كم تملك من مال ووقت قبل أن تحتاج إلى أول دخل؟ تحقّق من المتطلبات عند الجهة الرسمية في بلدك، ولا تعتمد على ما تسمعه.',
      },
      {
        id: 'decide',
        title: 'قرّر بمعايير كتبتها قبل الاختبار',
        body: 'اكتب مسبقًا ما الذي يجعلك تمضي، وما الذي يجعلك تعدّل، وما الذي يجعلك تتوقف. القرار بعد رؤية النتيجة يميل إلى تبرير ما نريده. وإن كان الحكم «توقّف» فالتوقف الآن أرخص من التوقف بعد أن تنفق.',
      },
    ],
    formulasHeading: 'المعادلتان الأساسيتان',
    formulasLead: 'يكفي بهما أن تعرف، قبل أي إنفاق، كم وحدة تحتاج أن تبيع كي لا تخسر.',
    formulas: [
      {
        id: 'margin',
        name: 'هامش المساهمة للوحدة',
        formula: 'سعر البيع − التكلفة المتغيرة للوحدة',
      },
      {
        id: 'break-even',
        name: 'نقطة التعادل (Break-even) بالوحدات',
        formula: 'التكاليف الثابتة الشهرية ÷ هامش المساهمة للوحدة',
      },
    ],
    exampleHeading: 'مثال توضيحي',
    example: [
      'سعر البيع: 50 دولارًا أمريكيًا (USD) للوحدة.',
      'التكلفة المتغيرة: 30 دولارًا أمريكيًا (USD) للوحدة، فهامش المساهمة 20 دولارًا أمريكيًا (USD).',
      'التكاليف الثابتة: 2000 دولار أمريكي (USD) شهريًا، فنقطة التعادل 100 وحدة شهريًا.',
    ],
    exampleNote:
      'الأرقام مختلقة لشرح المعادلة فقط، وليست بيانات عن سوق حقيقي. وهذه نقطة تعادل قبل تكلفة الوصول إلى العملاء وقبل الضرائب، فهي حدٌّ أدنى لا يكفي وحده للحكم.',
    mistakesHeading: 'أخطاء شائعة في اختبار الأفكار',
    mistakes: [
      {
        title: 'الاكتفاء برأي الأصدقاء والعائلة',
        body: 'يجاملونك غالبًا، ولا يدفعون. اسأل من يملك المشكلة فعلًا.',
      },
      {
        title: 'خلط الإيراد بالربح',
        body: 'المبيعات الكبيرة لا تعني ربحًا إن كانت التكلفة المتغيرة وتكلفة الوصول إلى العملاء تأكل الهامش.',
      },
      {
        title: 'نسيان التكاليف الثابتة',
        body: 'الإيجار والرواتب والاشتراكات تُدفع ولو لم تبع شيئًا. احسبها قبل أن تعد بالربح.',
      },
      {
        title: 'التسعير بلا معرفة تكلفة الوحدة',
        body: 'سعر يبدو منافسًا قد يكون أقل من تكلفتك الفعلية.',
      },
      {
        title: 'افتراض النمو بلا قناة',
        body: 'قل أين سيجدك العميل الأول وكم سيكلّفك، لا أنه «سينتشر».',
      },
    ],
    toolHeading: 'أين تساعدك المنصة، وأين لا',
    helpsLabel: 'تساعدك في',
    helps: [
      'مسار منظّم من الأسئلة يغطي المحاور الثمانية، فلا تنسى جانبًا من المشروع.',
      'أرقام تحسبها معادلات ثابتة مختبرة، لا نموذج لغوي يكتبها.',
      'حكم واضح: امضِ أو عدّل أو توقّف، مع تغييرات محدّدة، وتقرير عربي قابل للتصدير.',
    ],
    limitsLabel: 'لا تغني عن',
    limits: [
      'الحديث مع عملاء حقيقيين (الخطوتان 2 و3): المنصة تحسب من إجاباتك ولا تختبر السوق نيابةً عنك.',
      'الاستشارة القانونية أو المالية أو الضريبية؛ هي أداة تخطيط.',
    ],
    faqHeading: 'أسئلة شائعة عن اختبار الأفكار',
    faq: [
      {
        id: 'plan',
        question: 'ما الفرق بين اختبار فكرة وكتابة خطة عمل؟',
        answer:
          'خطة العمل تصف مشروعًا قرّرت تنفيذه. اختبار الفكرة يسبقها: يسأل هل يستحق المشروع أن يُنفَّذ أصلًا بأقل إنفاق ممكن، وينتهي بقرار.',
      },
      {
        id: 'landing',
        question: 'هل يكفي اختبار صفحة هبوط (Landing page)؟',
        answer:
          'تقيس صفحة الهبوط اهتمام الناس بوعد واحد، وهذا مفيد لاختبار الطلب. لكنها لا تكشف هل يغطّي السعر تكاليفك، ولا كم يكلّف الوصول إلى كل عميل، فتحتاج إلى حساب الأرقام أيضًا.',
      },
      {
        id: 'unknown',
        question: 'ماذا أفعل إن لم أعرف أرقامي بعد؟',
        answer:
          'ابدأ بتقدير مكتوب وسمِّه افتراضًا، ثم اختبره بالتدريج. في المنصة يمكنك في معظم الأسئلة اختيار «لا أعرف»، فنقترح نطاقًا ونعلّمه افتراضًا في التقرير.',
      },
      {
        id: 'ai',
        question: 'هل تعتمد المنصة على الذكاء الاصطناعي في حساب الأرقام؟',
        answer: 'لا. كل رقم يخرج من معادلات حتمية، والذكاء الاصطناعي يشرح الأرقام بعد حسابها فقط.',
      },
    ],
    start: 'ابدأ تشخيص فكرتك مجانًا',
    sample: 'شاهد تقريرًا نموذجيًا',
    questions: 'اطّلع على أسئلة التشخيص السريع',
    method: 'كيف نصل إلى الحكم',
  },
  en: {
    heading: 'How to test a business idea before you spend on it',
    lead: 'Test three things in order: is the problem real and do people pay to solve it, does the price cover your costs, and can you reach customers at a cost you can bear. Then make a clear decision: go, revise or stop. The seven steps below get you there before you build anything.',
    updatedLabel: 'Last updated',
    stepsHeading: 'Seven steps from idea to decision',
    steps: [
      {
        id: 'sentence',
        title: 'Write the idea in one sentence',
        body: 'Who is your customer? What problem do they have? What will you offer them? At what price? If you cannot say it in one sentence the idea is not defined yet, and any test after this measures something vague.',
      },
      {
        id: 'problem',
        title: 'Check that the problem is real',
        body: 'Talk to likely customers about what they actually did the last time they met the problem: how they solved it, what they paid, what annoyed them. Their past behaviour is more honest than their opinion of your idea, or the politeness of friends and family.',
      },
      {
        id: 'pay',
        title: 'Test the willingness to pay',
        body: 'Before you build, show the price to real people and ask for a small commitment: a booking, a deposit, or a named place on a waiting list. “I like the idea” is not a commitment.',
      },
      {
        id: 'numbers',
        title: 'Work out the economics of one unit',
        body: 'Start with the selling price and the variable cost of one unit, then add the monthly fixed costs. The gap between the price and the variable cost is the contribution margin: it covers the fixed costs first and only then becomes profit.',
      },
      {
        id: 'channel',
        title: 'Estimate the cost of reaching a customer',
        body: 'Try one channel with a small budget and measure the customer acquisition cost. If reaching a customer costs more than the margin that customer leaves you over the time they stay, the model does not work through that channel, even if sales grow.',
      },
      {
        id: 'limits',
        title: 'Check the constraints',
        body: 'Licences, taxes and legal requirements in your country, and your real resources: how much money and time do you have before you need the first income? Confirm the requirements with the official authority in your country; do not rely on what you hear.',
      },
      {
        id: 'decide',
        title: 'Decide by criteria you wrote before the test',
        body: 'Write down beforehand what makes you go, what makes you revise and what makes you stop. A decision made after seeing the result tends to justify what we already want. And if the verdict is “stop”, stopping now costs less than stopping after you have spent.',
      },
    ],
    formulasHeading: 'The two basic formulas',
    formulasLead:
      'With them you know, before spending anything, how many units you must sell not to lose money.',
    formulas: [
      {
        id: 'margin',
        name: 'Contribution margin per unit',
        formula: 'Selling price − variable cost per unit',
      },
      {
        id: 'break-even',
        name: 'Break-even point in units',
        formula: 'Monthly fixed costs ÷ contribution margin per unit',
      },
    ],
    exampleHeading: 'A worked example',
    example: [
      'Selling price: 50 US dollars (USD) per unit.',
      'Variable cost: 30 US dollars (USD) per unit, so the contribution margin is 20 US dollars (USD).',
      'Fixed costs: 2000 US dollars (USD) a month, so the break-even point is 100 units a month.',
    ],
    exampleNote:
      'The numbers are made up to explain the formula; they are not data about a real market. This break-even is before the cost of reaching customers and before tax, so it is a floor that is not enough on its own to decide.',
    mistakesHeading: 'Common mistakes when testing an idea',
    mistakes: [
      {
        title: 'Relying on friends and family',
        body: 'They are usually polite, and they do not pay. Ask the people who really have the problem.',
      },
      {
        title: 'Mixing revenue with profit',
        body: 'Large sales do not mean profit if variable cost and the cost of reaching customers eat the margin.',
      },
      {
        title: 'Forgetting fixed costs',
        body: 'Rent, salaries and subscriptions are paid even if you sell nothing. Count them before you promise a profit.',
      },
      {
        title: 'Pricing without knowing the unit cost',
        body: 'A price that looks competitive can be below your real cost.',
      },
      {
        title: 'Assuming growth without a channel',
        body: 'Say where the first customer will find you and what it will cost, not that it will “go viral”.',
      },
    ],
    toolHeading: 'Where the platform helps, and where it does not',
    helpsLabel: 'It helps you with',
    helps: [
      'A structured path of questions across the eight axes, so no side of the project is forgotten.',
      'Numbers calculated by tested fixed formulas, not written by a language model.',
      'A clear verdict, go, revise or stop, with specific changes, and an exportable Arabic report.',
    ],
    limitsLabel: 'It does not replace',
    limits: [
      'Talking to real customers (steps 2 and 3): the platform calculates from your answers and does not test the market for you.',
      'Legal, financial or tax advice; it is a planning tool.',
    ],
    faqHeading: 'Common questions about testing ideas',
    faq: [
      {
        id: 'plan',
        question: 'What is the difference between testing an idea and writing a business plan?',
        answer:
          'A business plan describes a project you have decided to carry out. Testing the idea comes first: it asks whether the project deserves to be carried out at all, at the least possible spend, and it ends in a decision.',
      },
      {
        id: 'landing',
        question: 'Is a landing page test enough?',
        answer:
          'A landing page measures interest in one promise, which is useful for testing demand. It does not show whether the price covers your costs, or what it costs to reach each customer, so you also need to calculate the numbers.',
      },
      {
        id: 'unknown',
        question: 'What if I do not know my numbers yet?',
        answer:
          'Start with a written estimate and call it an assumption, then test it step by step. In the platform you can choose “I don’t know” for most questions: we suggest a range and mark it as an assumption in the report.',
      },
      {
        id: 'ai',
        question: 'Does the platform use AI to calculate the numbers?',
        answer:
          'No. Every number comes from deterministic formulas; AI only explains the numbers after they are calculated.',
      },
    ],
    start: 'Start your idea diagnostic free',
    sample: 'See a sample report',
    questions: 'Read the quick diagnostic questions',
    method: 'How we reach the verdict',
  },
};
