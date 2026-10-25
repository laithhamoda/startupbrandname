import 'server-only';
import type { PublicPageId } from '@/config/public-pages';
import type { Localized, PageMeta } from './types';

export const PAGE_META: Localized<Record<PublicPageId, PageMeta>> = {
  ar: {
    home: {
      title: 'استوديو نموذج العمل',
      description:
        'تشخيص جدوى فكرة مشروعك بالأرقام: أسئلة منظّمة، وتقرير عربي بحكم واضح (امضِ أو عدّل أو توقّف)، ومرشد ذكي قريبًا.',
      card: 'حوّل فكرتك إلى نموذج عمل بأرقام محسوبة، لا مكتوبة',
    },
    howItWorks: {
      title: 'كيف تعمل المنصة',
      description:
        'من إنشاء الحساب إلى التقرير والحكم: الخطوات التي تمرّ بها فكرتك، وما تحصل عليه في كل خطوة.',
      card: 'من الفكرة إلى الحكم في سبع خطوات',
    },
    methodology: {
      title: 'المنهجية',
      description:
        'المحاور الثمانية للتشخيص، وقواعد قبول الإجابات، ومصدر كل رقم، وكيف نصل إلى الحكم: امضِ أو عدّل أو توقّف.',
      card: 'كيف نسأل، وكيف نحسب، وكيف نحكم',
    },
    pricing: {
      title: 'الأسعار',
      description:
        'خطط المنصة بالدولار الأمريكي: المجانية والأسبوعية والشهرية والسنوية، وما تتضمّنه كل خطة.',
      card: 'خطط واضحة بالدولار الأمريكي',
    },
    sampleReport: {
      title: 'تقرير نموذجي',
      description:
        'اطّلع على تقرير كامل لمشروع افتراضي: الحكم، والأرقام المحسوبة، والإسقاط المالي، والسيناريوهات، وخطة التحقق، قبل أن تبدأ تشخيص مشروعك.',
      card: 'شاهد تقريرًا كاملًا قبل أن تبدأ',
    },
    questions: {
      title: 'أسئلة التشخيص السريع',
      description:
        'الأسئلة العشرون التي يبدأ بها التشخيص السريع، مرتّبة في المحاور الثمانية، وما يبقى داخل التشخيص نفسه.',
      card: 'عشرون سؤالًا يبدأ بها تشخيص فكرتك',
    },
    ideaGuide: {
      title: 'كيف تختبر فكرة مشروعك قبل أن تنفق عليها',
      description:
        'دليل عملي من سبع خطوات لاختبار الفكرة: المشكلة، والاستعداد للدفع، والأرقام، وتكلفة الوصول إلى العميل، ثم قرار امضِ أو عدّل أو توقّف.',
      card: 'سبع خطوات لاختبار فكرتك قبل أن تنفق',
    },
    glossary: {
      title: 'مسرد مصطلحات نموذج العمل',
      description:
        'تعريفات عربية واضحة لمصطلحات نموذج العمل والتمويل، مثل نقطة التعادل وهامش المساهمة وتكلفة اكتساب العميل.',
      card: 'مصطلحات نموذج العمل بالعربية',
    },
    faq: {
      title: 'الأسئلة الشائعة',
      description:
        'إجابات عن الأسئلة المتكرّرة: الفرق عن روبوتات المحادثة، ومصدر الأرقام، والمدة، واللهجات، والخصوصية، والدفع.',
      card: 'أسئلة وأجوبة عن المنصة',
    },
    about: {
      title: 'عن المنصة',
      description:
        'منصة عربية مستقلة لتحليل نماذج الأعمال بأرقام محسوبة ومصادر مؤرّخة وحكم واضح. تعرّف إلى مبادئها.',
      card: 'منصة عربية لنماذج الأعمال',
    },
  },
  en: {
    home: {
      title: 'Business Model Studio',
      description:
        'A business idea diagnostic with calculated numbers: structured questions, an Arabic report with a clear verdict (go, revise or stop), and an AI mentor soon.',
      card: 'Turn your idea into a business model with numbers that are calculated, not written',
    },
    howItWorks: {
      title: 'How it works',
      description:
        'From creating an account to the report and its verdict: the steps your idea goes through, and what you get at each one.',
      card: 'From idea to verdict in seven steps',
    },
    methodology: {
      title: 'Methodology',
      description:
        'The eight axes of the diagnostic, the rules answers must pass, where every number comes from, and how the verdict is reached: go, revise or stop.',
      card: 'How we ask, how we calculate, how we decide',
    },
    pricing: {
      title: 'Pricing',
      description:
        'The platform’s plans in US dollars: free, weekly, monthly and annual, and what each one includes.',
      card: 'Clear plans in US dollars',
    },
    sampleReport: {
      title: 'Sample report',
      description:
        'See a full report for a fictional project: the verdict, calculated numbers, projection, scenarios and validation plan, before you start your own diagnostic.',
      card: 'See a full report before you start',
    },
    questions: {
      title: 'Quick diagnostic questions',
      description:
        'The 20 questions that open the quick diagnostic, grouped by the eight axes, and what stays inside the diagnostic itself.',
      card: 'Twenty questions to start diagnosing your idea',
    },
    ideaGuide: {
      title: 'How to test a business idea before you spend on it',
      description:
        'A seven-step guide to testing a business idea: the problem, willingness to pay, the numbers, the cost of reaching customers, then a go, revise or stop decision.',
      card: 'Seven steps to test your idea before you spend',
    },
    glossary: {
      title: 'Business model glossary',
      description:
        'Plain definitions of business model and finance terms such as break-even point, contribution margin and customer acquisition cost, in Arabic and English.',
      card: 'Business model terms in Arabic and English',
    },
    faq: {
      title: 'Frequently asked questions',
      description:
        'Answers to common questions: how it differs from a chatbot, where the numbers come from, time needed, dialects, privacy and payment.',
      card: 'Questions and answers about the platform',
    },
    about: {
      title: 'About',
      description:
        'An independent Arabic platform for analysing business models with calculated numbers, dated sources and a clear verdict. Read its principles.',
      card: 'An Arabic platform for business models',
    },
  },
};
