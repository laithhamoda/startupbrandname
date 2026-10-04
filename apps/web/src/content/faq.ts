import 'server-only';
import type { Localized } from './types';

export interface FaqContent {
  heading: string;
  lead: string;
  items: readonly { id: string; question: string; answer: string }[];
}

export const FAQ: Localized<FaqContent> = {
  ar: {
    heading: 'الأسئلة الشائعة',
    lead: 'إجابات مختصرة عن أكثر ما يُسأل عنه. للتفاصيل، راجع صفحتَي كيف تعمل المنصة والمنهجية.',
    items: [
      {
        id: 'chatbot',
        question: 'ما الفرق بين المنصة وبين سؤال روبوت محادثة عام؟',
        answer:
          'روبوت المحادثة يجيب عمّا تسأله، وقد يكتب أرقامًا تبدو مقنعة دون أن يحسبها. هنا تمرّ فكرتك بمسار إلزامي من الأسئلة، وتُحسب الأرقام بمعادلات مختبرة، وتُوسم كل معلومة بمصدرها، ويبقى مشروعك محفوظًا لتعدّله، وتخرج بتقرير قابل للتصدير ينتهي بحكم واضح.',
      },
      {
        id: 'numbers',
        question: 'هل الأرقام في التقرير من إنتاج الذكاء الاصطناعي؟',
        answer:
          'لا. كل رقم في التقرير يخرج من محرّك معادلات حتمي له اختبارات آلية. يتلقّى الذكاء الاصطناعي الأرقام بعد حسابها ليشرحها فقط.',
      },
      {
        id: 'duration',
        question: 'كم يستغرق التشخيص؟',
        answer:
          'النسخة السريعة 20 سؤالًا وتستغرق بين 15 و20 دقيقة. والنسخة الكاملة 64 سؤالًا مع أسئلة متابعة، وتستغرق بين 60 و90 دقيقة. تُحفظ إجاباتك فتكمل متى شئت.',
      },
      {
        id: 'dialect',
        question: 'هل يمكنني الكتابة بلهجتي؟',
        answer:
          'نعم. نفهم أي لهجة عربية، ومنها الدارجة الجزائرية الممزوجة بالفرنسية، ونعرض عليك فهمنا بالعربية الفصحى لتؤكّده. التقرير بالعربية الفصحى، والواجهة متاحة بالعربية والإنجليزية.',
      },
      {
        id: 'unknown',
        question: 'ماذا لو لم أعرف إجابة سؤال؟',
        answer:
          'قل «لا أعرف». تُحفظ الإجابة افتراضًا منخفض الثقة، ويظهر أثرها في التقرير، وتدخل في خطة التحقّق لتختبرها. وإن لم تعرف رقمًا، نقترح عليك نطاقًا تختار منه.',
      },
      {
        id: 'free',
        question: 'ماذا أحصل عليه مجانًا؟',
        answer:
          'مشروع واحد، وملخّص في صفحة واحدة حين تبلغ إجاباتك 40% من الاكتمال، و3 رسائل يوميًا مع المرشد الذكي. ويُحفظ المشروع المجاني 30 يومًا.',
      },
      {
        id: 'verdict',
        question: 'ماذا يعني حكم «توقّف»؟',
        answer:
          'يعني أن النموذج غير قابل للتنفيذ بصيغته الحالية، لا أن فكرتك سيئة. ويأتي الحكم دائمًا مع ثلاثة تغييرات محدّدة، لو أجريتها لتغيّر الحكم.',
      },
      {
        id: 'advice',
        question: 'هل التقرير استشارة قانونية أو مالية؟',
        answer:
          'لا. المنصة أداة تخطيط. المعلومات القانونية والضريبية تأتي من مصادر رسمية تُذكر مع تاريخ آخر تحقّق منها، فتحقّق منها مع الجهة المختصة أو مع مختص قبل أي التزام.',
      },
      {
        id: 'countries',
        question: 'من أي الدول يمكنني استخدام المنصة؟',
        answer:
          'يمكنك التسجيل من أي دولة. أما دليل التسجيل والتراخيص والضرائب فيغطي الأردن والجزائر عند إطلاقه.',
      },
      {
        id: 'data',
        question: 'أين تُحفظ بياناتي، ومن يراها؟',
        answer:
          'تُحفظ في قاعدة بيانات في فرانكفورت بألمانيا، ولا يستطيع أي مستخدم آخر الوصول إلى مشاريعك. ومراجعة إجاباتك المكتوبة بالذكاء الاصطناعي، والمرشد الذكي لاحقًا، تعملان فقط بموافقتك، لأن معالجتهما تتم لدى Anthropic في الولايات المتحدة. ونحذف قبل أي طلب اسمك وعناوين البريد الإلكتروني وما نتعرّف عليه من بيانات التواصل. التفاصيل في سياسة الخصوصية.',
      },
      {
        id: 'payment',
        question: 'كيف أدفع؟',
        answer:
          'الأسعار بالدولار الأمريكي، والدفع ببطاقات Visa والبطاقات الدولية الأخرى أو عبر PayPal، ولا نحفظ بيانات بطاقتك. الاشتراكات المدفوعة غير متاحة بعد.',
      },
      {
        id: 'viva',
        question: 'ما كود VIVA؟',
        answer:
          'كود يحصل عليه متدرّبو دورة «الذكاء الاصطناعي في ريادة الأعمال»، ويمنح مزايا الخطة السنوية مجانًا لمدة 12 شهرًا من تاريخ تفعيله. يبدأ الكود بـ VIVA تليه 8 رموز، ويُتاح تفعيله مع فتح الاشتراكات.',
      },
      {
        id: 'delete',
        question: 'هل يمكنني حذف حسابي؟',
        answer: 'نعم، من صفحة حسابك في أي وقت. الحذف فوري ويشمل كل بياناتك.',
      },
    ],
  },
  en: {
    heading: 'Frequently asked questions',
    lead: 'Short answers to the most common questions. For details, see How it works and Methodology.',
    items: [
      {
        id: 'chatbot',
        question: 'How is this different from asking a general chatbot?',
        answer:
          'A chatbot answers what you ask and may write numbers that look convincing without calculating them. Here your idea goes through a set path of questions, numbers are calculated by tested formulas, every fact is tagged with its source, your project stays saved so you can change it, and you get an exportable report that ends with a clear verdict.',
      },
      {
        id: 'numbers',
        question: 'Are the numbers in the report produced by AI?',
        answer:
          'No. Every number in the report comes from a deterministic formula engine with automated tests. AI receives the numbers after they are calculated, only to explain them.',
      },
      {
        id: 'duration',
        question: 'How long does the diagnostic take?',
        answer:
          'The quick version has 20 questions and takes 15 to 20 minutes. The full version has 64 questions plus follow-ups and takes 60 to 90 minutes. Your answers are saved, so you can continue whenever you like.',
      },
      {
        id: 'dialect',
        question: 'Can I write in my own dialect?',
        answer:
          'Yes. We understand any Arabic dialect, including Algerian Darja mixed with French, and show you our reading in Modern Standard Arabic to confirm. The report is in Modern Standard Arabic; the interface is available in Arabic and English.',
      },
      {
        id: 'unknown',
        question: 'What if I don’t know an answer?',
        answer:
          'Say so. The answer is saved as a low-confidence assumption, its effect shows in the report, and it goes into the validation plan for you to test. If you don’t know a number, we suggest a range to choose from.',
      },
      {
        id: 'free',
        question: 'What do I get for free?',
        answer:
          'One project, a one-page summary once your answers reach 40% completeness, and 3 messages a day with the AI mentor. A free project is kept for 30 days.',
      },
      {
        id: 'verdict',
        question: 'What does a “stop” verdict mean?',
        answer:
          'It means the model is not viable in its current form, not that your idea is bad. The verdict always comes with three specific changes that would turn it.',
      },
      {
        id: 'advice',
        question: 'Is the report legal or financial advice?',
        answer:
          'No. The platform is a planning tool. Legal and tax information comes from official sources shown with the date they were last checked; confirm it with the relevant authority or a professional before you commit to anything.',
      },
      {
        id: 'countries',
        question: 'Which countries can I use the platform from?',
        answer:
          'You can sign up from any country. The registration, licensing and tax guide covers Jordan and Algeria when it launches.',
      },
      {
        id: 'data',
        question: 'Where is my data kept, and who can see it?',
        answer:
          'In a database in Frankfurt, Germany, and no other user can reach your projects. The AI review of the answers you type, and later the AI mentor, run only with your consent, because they are processed by Anthropic in the United States. Before any request we remove your name, email addresses and the contact details we recognise. Details are in the privacy policy.',
      },
      {
        id: 'payment',
        question: 'How do I pay?',
        answer:
          'Prices are in US dollars. You can pay by Visa or another international card, or with PayPal, and we never store your card details. Paid plans are not available yet.',
      },
      {
        id: 'viva',
        question: 'What is a VIVA code?',
        answer:
          'A code given to trainees of the “AI in Entrepreneurship” course. It unlocks the annual plan free for 12 months from the day it is activated. Codes start with VIVA followed by 8 characters, and can be activated once paid plans open.',
      },
      {
        id: 'delete',
        question: 'Can I delete my account?',
        answer:
          'Yes, from your account page at any time. Deletion is immediate and covers all your data.',
      },
    ],
  },
};
