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

/** Date of the last edit of the guide's text; change it whenever the text changes (D-306, D-307). */
export const IDEA_GUIDE_UPDATED = '2026-10-25';

/**
 * The public guide «how to test an online business idea». It is written for online projects
 * (a store, a digital product or app, a subscription, an online service, a marketplace) and says
 * plainly that it does not cover a project that depends on a physical place (D-307). General
 * knowledge that any founder can use, with no question wording, rule, weight or threshold of the
 * diagnostic. The example numbers are made up for the explanation and say so, with an explicit
 * currency (CLAUDE.md §3). Arabic is the reference; the English version has the same shape
 * (idea-guide.test.ts).
 */
export const IDEA_GUIDE: Localized<IdeaGuideContent> = {
  ar: {
    heading: 'كيف تختبر فكرة مشروعك الإلكتروني قبل أن تنفق عليه',
    lead: 'اختبر ثلاثة أشياء بالترتيب: هل المشكلة حقيقية ويدفع الناس لحلّها، وهل يغطّي السعر تكاليفك بعد رسوم الدفع والمنصات، وهل تصل إلى العملاء عبر الإنترنت بتكلفة تتحمّلها. ثم اتخذ قرارًا واضحًا: امضِ أو عدّل أو توقّف. الخطوات السبع أدناه لمتجر إلكتروني أو منتج رقمي أو تطبيق أو اشتراك أو خدمة عبر الإنترنت، وتقودك إلى القرار قبل أن تبني شيئًا.',
    updatedLabel: 'آخر تحديث',
    stepsHeading: 'سبع خطوات من الفكرة إلى القرار',
    steps: [
      {
        id: 'sentence',
        title: 'اكتب الفكرة في جملة واحدة',
        body: 'من هو عميلك؟ ما المشكلة التي يعيشها؟ ما الذي ستبيعه له عبر الإنترنت؟ وبكم؟ إن لم تستطع قول ذلك في جملة واحدة فالفكرة لم تتحدد بعد، وأي اختبار بعدها سيقيس شيئًا غامضًا.',
      },
      {
        id: 'problem',
        title: 'تحقّق من أن المشكلة حقيقية',
        body: 'تحدّث مع عملاء محتملين عمّا فعلوه فعلًا في آخر مرة واجهوا فيها المشكلة: كيف بحثوا عن حل، وماذا اشتروا، وكم دفعوا، وما الذي أزعجهم. سلوكهم السابق أصدق من رأيهم في فكرتك، ومن مجاملة الأصدقاء والأقارب.',
      },
      {
        id: 'pay',
        title: 'اختبر الاستعداد للدفع',
        body: 'قبل أن تبني المتجر أو المنتج، اعرض الوصف والسعر في صفحة بسيطة واطلب التزامًا صغيرًا: حجزًا، أو دفعة مقدّمة، أو تسجيلًا بالاسم في قائمة انتظار. عدد الزيارات لا يدل على شيء ما لم يتحول جزء منها إلى التزام. وعبارة «أعجبتني الفكرة» ليست التزامًا.',
      },
      {
        id: 'numbers',
        title: 'احسب الاقتصاد على وحدة واحدة',
        body: 'ابدأ بسعر البيع، ثم اطرح كل ما يُدفع عن كل طلب: تكلفة المنتج أو الخدمة، والشحن إن كان ماديًا، ورسوم بوابة الدفع، وعمولة المنصة التي تبيع عبرها، وتقدير المرتجعات. الباقي هو هامش المساهمة (Contribution margin)، وهو ما يغطّي التكاليف الثابتة الشهرية أولًا، كالاشتراكات والاستضافة والأدوات، ثم يصير ربحًا.',
      },
      {
        id: 'channel',
        title: 'قدّر تكلفة الوصول إلى العميل',
        body: 'جرّب قناة واحدة بميزانية صغيرة، كإعلان مدفوع أو محتوى أو بريد، وسجّل ثلاثة أرقام: تكلفة الزيارة، ونسبة الزوار الذين يشترون، وتكلفة اكتساب العميل (Customer acquisition cost) الناتجة عنهما. إن كان العميل يكلّفك للوصول إليه أكثر مما يتركه لك من هامش على مدى تعامله معك، فالنموذج لا يعمل بهذه القناة ولو ازدادت الزيارات.',
      },
      {
        id: 'limits',
        title: 'افحص القيود',
        body: 'التسجيل والترخيص والضرائب على المبيعات عبر الإنترنت في بلدك، وحماية بيانات العملاء، وهل يعمل مزوّد الدفع الذي تريده في بلدك، وشروط المنصة التي تبيع عبرها. وافحص مواردك الفعلية: كم تملك من مال ووقت قبل أن تحتاج إلى أول دخل؟ تحقّق من المتطلبات عند الجهة الرسمية في بلدك، ولا تعتمد على ما تسمعه.',
      },
      {
        id: 'decide',
        title: 'قرّر بمعايير كتبتها قبل الاختبار',
        body: 'اكتب مسبقًا ما الذي يجعلك تمضي، وما الذي يجعلك تعدّل، وما الذي يجعلك تتوقف. القرار بعد رؤية النتيجة يميل إلى تبرير ما نريده. وإن كان الحكم «توقّف» فالتوقف الآن أرخص من التوقف بعد أن تنفق.',
      },
    ],
    formulasHeading: 'المعادلتان الأساسيتان',
    formulasLead: 'يكفي بهما أن تعرف، قبل أي إنفاق، كم طلبًا تحتاج أن تبيع كي لا تخسر.',
    formulas: [
      {
        id: 'margin',
        name: 'هامش المساهمة للطلب',
        formula: 'سعر البيع − كل ما يُدفع عن الطلب (المنتج، الشحن، رسوم الدفع، المرتجعات)',
      },
      {
        id: 'break-even',
        name: 'نقطة التعادل (Break-even) بالطلبات',
        formula: 'التكاليف الثابتة الشهرية ÷ هامش المساهمة للطلب',
      },
    ],
    exampleHeading: 'مثال توضيحي لمتجر إلكتروني',
    example: [
      'سعر البيع: 50 دولارًا أمريكيًا (USD) للطلب.',
      'ما يُدفع عن كل طلب: المنتج 20 والشحن 6 ورسوم الدفع 2 والمرتجعات 2، فالمجموع 30 دولارًا أمريكيًا (USD).',
      'هامش المساهمة: 20 دولارًا أمريكيًا (USD) للطلب.',
      'التكاليف الثابتة: 2000 دولار أمريكي (USD) شهريًا، فنقطة التعادل 100 طلب شهريًا.',
    ],
    exampleNote:
      'الأرقام مختلقة لشرح المعادلة فقط، وليست بيانات عن سوق حقيقي. وهذه نقطة تعادل قبل تكلفة الوصول إلى العملاء وقبل الضرائب، فهي حدٌّ أدنى لا يكفي وحده للحكم.',
    mistakesHeading: 'أخطاء شائعة في اختبار المشاريع الإلكترونية',
    mistakes: [
      {
        title: 'الخلط بين الزيارات والعملاء',
        body: 'آلاف الزيارات بلا شراء لا تعني طلبًا. قِس نسبة من يشتري، لا عدد من يزور.',
      },
      {
        title: 'تجاهل رسوم الدفع والمنصات والمرتجعات',
        body: 'تبدو صغيرة في كل طلب، لكنها تأكل جزءًا من الهامش الذي بنيت عليه حساباتك.',
      },
      {
        title: 'نسيان التكاليف الثابتة',
        body: 'اشتراكات المنصات والاستضافة والأدوات تُدفع ولو لم تبع شيئًا. احسبها قبل أن تعد بالربح.',
      },
      {
        title: 'افتراض أن العميل سيجدك وحده',
        body: 'قل أين سيجدك العميل الأول وكم سيكلّفك ذلك، لا أن المشروع «سينتشر».',
      },
      {
        title: 'إهمال بقاء العميل في الاشتراكات',
        body: 'في الاشتراك لا يكفي أن يشترك العميل مرة. احسب كم شهرًا سيبقى، فبه يتحدد ما تكسبه منه.',
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
    faqHeading: 'أسئلة شائعة عن اختبار المشاريع الإلكترونية',
    faq: [
      {
        id: 'offline',
        question: 'هل ينطبق الدليل على مشروع يعتمد على مكان فعلي؟',
        answer:
          'الدليل مكتوب للمشاريع الإلكترونية. أفكاره العامة، كالتحقق من المشكلة والاستعداد للدفع ونقطة التعادل، تصلح لأي مشروع، لكن حسابات المحل والإيجار وموقع الزبائن تختلف ولا يغطيها هذا الدليل.',
      },
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
    heading: 'How to test an online business idea before you spend on it',
    lead: 'Test three things in order: is the problem real and do people pay to solve it, does the price cover your costs after payment and platform fees, and can you reach customers online at a cost you can bear. Then make a clear decision: go, revise or stop. The seven steps below are for an online store, a digital product or app, a subscription or an online service, and get you to the decision before you build anything.',
    updatedLabel: 'Last updated',
    stepsHeading: 'Seven steps from idea to decision',
    steps: [
      {
        id: 'sentence',
        title: 'Write the idea in one sentence',
        body: 'Who is your customer? What problem do they have? What will you sell them online? At what price? If you cannot say it in one sentence the idea is not defined yet, and any test after this measures something vague.',
      },
      {
        id: 'problem',
        title: 'Check that the problem is real',
        body: 'Talk to likely customers about what they actually did the last time they met the problem: how they looked for a solution, what they bought, what they paid, what annoyed them. Their past behaviour is more honest than their opinion of your idea, or the politeness of friends and family.',
      },
      {
        id: 'pay',
        title: 'Test the willingness to pay',
        body: 'Before you build the store or the product, show the description and the price on a simple page and ask for a small commitment: a booking, a deposit, or a named place on a waiting list. A count of visits tells you nothing until some of them turn into a commitment. And “I like the idea” is not a commitment.',
      },
      {
        id: 'numbers',
        title: 'Work out the economics of one order',
        body: 'Start with the selling price, then subtract everything paid for each order: the cost of the product or service, shipping if it is physical, the payment gateway fee, the commission of the platform you sell through, and an allowance for returns. What is left is the contribution margin: it covers the monthly fixed costs first, such as subscriptions, hosting and tools, and only then becomes profit.',
      },
      {
        id: 'channel',
        title: 'Estimate the cost of reaching a customer',
        body: 'Try one channel with a small budget, such as a paid ad, content or email, and record three numbers: the cost of a visit, the share of visitors who buy, and the customer acquisition cost that follows from them. If reaching a customer costs more than the margin that customer leaves you over the time they stay, the model does not work through that channel, even if visits grow.',
      },
      {
        id: 'limits',
        title: 'Check the constraints',
        body: 'Registration, licences and taxes on online sales in your country, the protection of customer data, whether the payment provider you want works in your country, and the rules of the platform you sell through. Then check your real resources: how much money and time do you have before you need the first income? Confirm the requirements with the official authority in your country; do not rely on what you hear.',
      },
      {
        id: 'decide',
        title: 'Decide by criteria you wrote before the test',
        body: 'Write down beforehand what makes you go, what makes you revise and what makes you stop. A decision made after seeing the result tends to justify what we already want. And if the verdict is “stop”, stopping now costs less than stopping after you have spent.',
      },
    ],
    formulasHeading: 'The two basic formulas',
    formulasLead:
      'With them you know, before spending anything, how many orders you must sell not to lose money.',
    formulas: [
      {
        id: 'margin',
        name: 'Contribution margin per order',
        formula:
          'Selling price − everything paid for the order (product, shipping, payment fee, returns)',
      },
      {
        id: 'break-even',
        name: 'Break-even point in orders',
        formula: 'Monthly fixed costs ÷ contribution margin per order',
      },
    ],
    exampleHeading: 'A worked example for an online store',
    example: [
      'Selling price: 50 US dollars (USD) per order.',
      'Paid for each order: product 20, shipping 6, payment fee 2 and returns 2, so the total is 30 US dollars (USD).',
      'Contribution margin: 20 US dollars (USD) per order.',
      'Fixed costs: 2000 US dollars (USD) a month, so the break-even point is 100 orders a month.',
    ],
    exampleNote:
      'The numbers are made up to explain the formula; they are not data about a real market. This break-even is before the cost of reaching customers and before tax, so it is a floor that is not enough on its own to decide.',
    mistakesHeading: 'Common mistakes when testing an online business',
    mistakes: [
      {
        title: 'Mixing visits with customers',
        body: 'Thousands of visits with no purchase are not demand. Measure the share who buy, not the number who visit.',
      },
      {
        title: 'Ignoring payment, platform and return costs',
        body: 'They look small on each order, but they eat into the margin your calculations rest on.',
      },
      {
        title: 'Forgetting fixed costs',
        body: 'Platform subscriptions, hosting and tools are paid even if you sell nothing. Count them before you promise a profit.',
      },
      {
        title: 'Assuming customers will find you on their own',
        body: 'Say where the first customer will find you and what it will cost, not that the project will “go viral”.',
      },
      {
        title: 'Neglecting how long subscribers stay',
        body: 'With a subscription it is not enough that a customer signs up once. Work out how many months they stay: that decides what you earn from them.',
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
    faqHeading: 'Common questions about testing online businesses',
    faq: [
      {
        id: 'offline',
        question: 'Does the guide apply to a project that depends on a physical place?',
        answer:
          'The guide is written for online projects. Its general ideas, such as checking the problem, the willingness to pay and the break-even point, suit any project, but the sums for a shop, its rent and where its customers are differ and are not covered here.',
      },
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
