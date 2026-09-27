import 'server-only';
import type { Localized } from './types';

export interface HowItWorksContent {
  heading: string;
  lead: string;
  stepsHeading: string;
  steps: readonly { id: string; title: string; body: readonly string[] }[];
  gatingHeading: string;
  gatingLead: string;
  gatingCaption: string;
  gatingColumns: { threshold: string; result: string };
  gating: readonly { threshold: string; result: string }[];
}

export const HOW_IT_WORKS: Localized<HowItWorksContent> = {
  ar: {
    heading: 'كيف تعمل المنصة',
    lead: 'من إنشاء الحساب إلى التقرير والحكم، تمرّ فكرتك بسبع خطوات. تصف هذه الصفحة المنصة كما نبنيها الآن، ونطلق أجزاءها تباعًا.',
    stepsHeading: 'الخطوات',
    steps: [
      {
        id: 'account',
        title: 'أنشئ حسابك',
        body: [
          'ادخل ببريدك الإلكتروني فيصلك رمز دخول من 8 أرقام، أو ادخل بحساب Google.',
          'نسألك سؤالين فقط: دولتك، وهل لديك مشروع أو فكرة مشروع. لا نطلب تاريخ ميلادك ولا صور شهاداتك.',
        ],
      },
      {
        id: 'mode',
        title: 'اختر نسخة التشخيص',
        body: [
          'النسخة السريعة: 20 سؤالًا أساسيًا تستغرق بين 15 و20 دقيقة، وتكفي للملخّص المجاني في صفحة واحدة.',
          'النسخة الكاملة: 64 سؤالًا في ثمانية محاور مع أسئلة متابعة، وتستغرق بين 60 و90 دقيقة. تُحفظ إجاباتك فتكمل متى شئت.',
        ],
      },
      {
        id: 'answer',
        title: 'أجب بطريقتك',
        body: [
          'اكتب بأي لهجة عربية، ومنها الدارجة الجزائرية الممزوجة بالفرنسية. نعرض عليك فهمنا بالعربية الفصحى لتؤكّده، ولا نصحّح لهجتك.',
          'إن لم تعرف إجابة فقل «لا أعرف»: تُحفظ افتراضًا منخفض الثقة وتدخل في خطة التحقّق. والإجابة المبهمة، مثل «عملائي هم الجميع»، تُقابَل بسؤال أدق.',
        ],
      },
      {
        id: 'calculate',
        title: 'تُحسب الأرقام',
        body: [
          'يحسب محرّك المعادلات الحد الأدنى للسعر، وهامش المساهمة (Contribution margin)، ونقطة التعادل (Break-even)، والتوقعات المالية لثلاث سنوات: شهريًا في السنة الأولى، وكل ثلاثة أشهر في الثانية والثالثة.',
          'ثم يعيد الحساب في ثلاثة سيناريوهات: متحفّظ وأساسي ومتفائل. المدخلات نفسها تعطي النتائج نفسها في كل مرة.',
        ],
      },
      {
        id: 'report',
        title: 'اقرأ التقرير والحكم',
        body: [
          'يبدأ التقرير بملخّص تنفيذي ينتهي بحكم: امضِ، أو عدّل، أو توقّف. وحكم «توقّف» يُكتب دائمًا «غير قابل للتنفيذ بصيغته الحالية» مع ثلاثة تغييرات محدّدة تقلبه.',
          'يلي الملخّص نموذج العمل، والتسعير، والتوقعات المالية، والسيناريوهات، والمسار القانوني والتمويل. والرقم المحوري منخفض الثقة يظهر بتنبيه: «هذا الرقم افتراض، اختبره قبل أن تبني عليه قراراً.»',
          'يُصدَّر التقرير ملف PDF بالعربية.',
        ],
      },
      {
        id: 'mentor',
        title: 'ناقش المرشد الذكي',
        body: [
          'مرشد يسأل أكثر مما يجيب، ويشير إلى أضعف نقطة في نموذجك دون مجاملة، ويستند إلى إجاباتك بأرقامها.',
          'لا يخترع المرشد أرقامًا، ولا يقدّم استشارة قانونية أو ضريبية ملزمة. ويعمل فقط بموافقتك على معالجة محتوى مشروعك، دون اسمك أو بريدك، خارج بلدك.',
        ],
      },
      {
        id: 'validate',
        title: 'اختبر قبل أن تبني',
        body: [
          'تنتهي الرحلة بخطة تحقّق لمدة 30 يومًا لأضعف ثلاثة افتراضات في نموذجك: لكل افتراض تجربة، ومؤشّر، وعتبة نجاح محدّدة مسبقًا، وتكلفة، وبديل إن لم تنجح.',
        ],
      },
    ],
    gatingHeading: 'ما تحصل عليه حسب اكتمال إجاباتك',
    gatingLead:
      'نقيس اكتمال التشخيص بأوزان تعطي الأرقام والعميل النصيب الأكبر، وعلى الدرجة يتوقّف ما يمكن إصداره.',
    gatingCaption: 'المخرجات حسب درجة الاكتمال',
    gatingColumns: { threshold: 'درجة الاكتمال', result: 'ما تحصل عليه' },
    gating: [
      { threshold: 'أقل من 40%', result: 'لا تقرير بعد. نعرض عليك أهم الأسئلة الناقصة.' },
      {
        threshold: 'من 40% إلى 79%',
        result:
          'ملخّص مجاني في صفحة واحدة: بطاقة المشروع، وأكبر ثلاثة مخاطر، وتقدير لنقطة التعادل.',
      },
      {
        threshold: '80% فأكثر، مع اكتمال السعر والتكاليف',
        result:
          'التقرير الكامل ضمن الخطط المدفوعة. والتكاليف هنا: المتغيرة، والثابتة، وتكاليف التأسيس.',
      },
    ],
  },
  en: {
    heading: 'How it works',
    lead: 'From creating an account to the report and its verdict, your idea goes through seven steps. This page describes the platform as we are building it; its parts are released in turn.',
    stepsHeading: 'The steps',
    steps: [
      {
        id: 'account',
        title: 'Create your account',
        body: [
          'Sign in with your email address and receive an 8-digit code, or use your Google account.',
          'We ask two questions only: your country, and whether you have a project or a project idea. We never ask for your date of birth or for certificates.',
        ],
      },
      {
        id: 'mode',
        title: 'Choose the diagnostic',
        body: [
          'Quick: 20 core questions that take 15 to 20 minutes and are enough for the free one-page summary.',
          'Full: 64 questions across eight axes plus follow-ups, taking 60 to 90 minutes. Your answers are saved, so you can continue whenever you like.',
        ],
      },
      {
        id: 'answer',
        title: 'Answer your way',
        body: [
          'Write in any Arabic dialect, including Algerian Darja mixed with French. We show you our reading in Modern Standard Arabic to confirm, and never correct your dialect.',
          'If you don’t know an answer, say so: it is saved as a low-confidence assumption and goes into the validation plan. A vague answer such as “my customers are everyone” is met with a sharper question.',
        ],
      },
      {
        id: 'calculate',
        title: 'The numbers are calculated',
        body: [
          'The formula engine calculates the price floor, the contribution margin, the break-even point and a three-year financial projection: monthly in year one, quarterly in years two and three.',
          'It then recalculates under three scenarios: conservative, base and optimistic. The same inputs always give the same results.',
        ],
      },
      {
        id: 'report',
        title: 'Read the report and the verdict',
        body: [
          'The report opens with an executive summary that ends in a verdict: go, revise or stop. A “stop” always reads “not viable in its current form” and comes with three specific changes that would turn it.',
          'After the summary come the business model, pricing, the financial projection, the scenarios, and the legal path and financing. A pivotal number with low confidence carries a warning: “This number is an assumption. Test it before you base a decision on it.”',
          'The report is exported as an Arabic PDF.',
        ],
      },
      {
        id: 'mentor',
        title: 'Talk it through with the AI mentor',
        body: [
          'A mentor that asks more than it answers, points to the weakest part of your model without flattery, and works from your own answers and numbers.',
          'The mentor never invents numbers and gives no binding legal or tax advice. It only runs with your consent to process your project content, without your name or email, outside your country.',
        ],
      },
      {
        id: 'validate',
        title: 'Test before you build',
        body: [
          'The journey ends with a 30-day validation plan for the three weakest assumptions in your model: for each, an experiment, a metric, a success threshold set in advance, a cost and a fallback if it fails.',
        ],
      },
    ],
    gatingHeading: 'What you get as your answers fill in',
    gatingLead:
      'Completeness is measured with weights that give the numbers and the customer the largest share, and the score decides what can be produced.',
    gatingCaption: 'Output by completeness score',
    gatingColumns: { threshold: 'Completeness', result: 'What you get' },
    gating: [
      {
        threshold: 'Below 40%',
        result: 'No report yet. We list the most important missing questions.',
      },
      {
        threshold: '40% to 79%',
        result:
          'A free one-page summary: the project card, the top three risks and an estimate of the break-even point.',
      },
      {
        threshold: '80% or more, with price and costs complete',
        result:
          'The full report, on the paid plans. Costs here means variable, fixed and set-up costs.',
      },
    ],
  },
};
