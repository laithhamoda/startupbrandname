import 'server-only';
import type { Locale } from '@/i18n/routing';
import type { Localized } from './types';

export type GlossaryCategory = 'model' | 'costs' | 'cash' | 'customers' | 'market';

export interface GlossaryTerm {
  /** Anchor on the page (#break-even) and the DefinedTerm identifier. */
  id: string;
  category: GlossaryCategory;
  /** Written in each language; `en.term` is also shown beside the Arabic term. */
  text: Record<Locale, { term: string; definition: string }>;
}

export const GLOSSARY_CATEGORIES: Localized<Record<GlossaryCategory, string>> = {
  ar: {
    model: 'نموذج العمل',
    costs: 'التكاليف والأرباح',
    cash: 'النقد والتمويل',
    customers: 'العملاء',
    market: 'السوق والتحليل',
  },
  en: {
    model: 'The business model',
    costs: 'Costs and profit',
    cash: 'Cash and funding',
    customers: 'Customers',
    market: 'Market and analysis',
  },
};

export const GLOSSARY_INTRO: Localized<{
  heading: string;
  lead: string;
  sections: string;
  english: string;
}> = {
  ar: {
    heading: 'مسرد مصطلحات نموذج العمل',
    lead: 'تعريفات قصيرة للمصطلحات التي تقابلها في التشخيص والتقرير، مع مقابلها الإنجليزي. وحيث تستخدم المنصة معادلة، نذكرها كما تُحسب.',
    sections: 'أقسام المسرد',
    english: 'بالإنجليزية',
  },
  en: {
    heading: 'Business model glossary',
    lead: 'Short definitions of the terms you meet in the diagnostic and the report, with the Arabic term beside each. Where the platform uses a formula, we give it as calculated.',
    sections: 'Glossary sections',
    english: 'In Arabic',
  },
};

export const GLOSSARY: readonly GlossaryTerm[] = [
  // The business model
  {
    id: 'business-model',
    category: 'model',
    text: {
      ar: {
        term: 'نموذج العمل',
        definition:
          'الطريقة التي يقدّم بها المشروع قيمة لعملائه ويحصل منهم على إيراد يغطي تكاليفه ويحقّق ربحًا.',
      },
      en: {
        term: 'Business model',
        definition:
          'How a business creates value for its customers and earns revenue that covers its costs and leaves a profit.',
      },
    },
  },
  {
    id: 'business-model-canvas',
    category: 'model',
    text: {
      ar: {
        term: 'لوحة نموذج العمل',
        definition:
          'أداة من تسع خانات تصف المشروع في صفحة واحدة: شرائح العملاء، والقيمة المقدّمة، والقنوات، والعلاقات مع العملاء، ومصادر الإيرادات، والموارد والأنشطة والشركاء الرئيسيون، وهيكل التكاليف.',
      },
      en: {
        term: 'Business Model Canvas',
        definition:
          'A nine-block tool that describes a business on one page: customer segments, value proposition, channels, customer relationships, revenue streams, key resources, key activities, key partners and cost structure.',
      },
    },
  },
  {
    id: 'lean-canvas',
    category: 'model',
    text: {
      ar: {
        term: 'اللوحة الرشيقة',
        definition:
          'نسخة من لوحة نموذج العمل موجّهة للمشاريع الناشئة، تضع مكان بعض الخانات المشكلة، والحل، والمؤشرات الرئيسية، والميزة التي يصعب نسخها.',
      },
      en: {
        term: 'Lean Canvas',
        definition:
          'A version of the Business Model Canvas for new ventures that replaces some blocks with the problem, the solution, key metrics and an unfair advantage.',
      },
    },
  },
  {
    id: 'value-proposition',
    category: 'model',
    text: {
      ar: {
        term: 'القيمة المقدّمة',
        definition:
          'السبب الذي يجعل العميل يختارك: المشكلة التي تحلّها له أو المكسب الذي تحقّقه، مقارنةً بالبدائل المتاحة.',
      },
      en: {
        term: 'Value proposition',
        definition:
          'The reason a customer chooses you: the problem you solve or the gain you deliver, compared with the alternatives available.',
      },
    },
  },
  {
    id: 'mvp',
    category: 'model',
    text: {
      ar: {
        term: 'الحد الأدنى من المنتج القابل للتطبيق',
        definition:
          'أبسط نسخة من منتجك تكفي لاختبار افتراض رئيسي مع عملاء حقيقيين، بأقل تكلفة ووقت.',
      },
      en: {
        term: 'Minimum viable product (MVP)',
        definition:
          'The simplest version of your product that is enough to test a key assumption with real customers, at the lowest cost and time.',
      },
    },
  },
  {
    id: 'assumption',
    category: 'model',
    text: {
      ar: {
        term: 'الافتراض',
        definition:
          'قيمة أو معلومة يقوم عليها نموذجك ولم تتأكّد منها بعد، مثل نسبة من سيشترون. تُختبر قبل أن يُبنى عليها قرار.',
      },
      en: {
        term: 'Assumption',
        definition:
          'A value or fact your model relies on that you have not yet confirmed, such as the share of people who will buy. It should be tested before a decision rests on it.',
      },
    },
  },

  // Costs and profit
  {
    id: 'variable-cost',
    category: 'costs',
    text: {
      ar: {
        term: 'التكلفة المتغيرة',
        definition: 'تكلفة تزيد مع كل وحدة تبيعها، مثل المواد والتغليف والتوصيل وعمولة منصة الدفع.',
      },
      en: {
        term: 'Variable cost',
        definition:
          'A cost that rises with every unit you sell, such as materials, packaging, delivery and payment platform fees.',
      },
    },
  },
  {
    id: 'fixed-cost',
    category: 'costs',
    text: {
      ar: {
        term: 'التكلفة الثابتة',
        definition: 'تكلفة تدفعها كل شهر مهما كان حجم مبيعاتك، مثل الإيجار والرواتب والاشتراكات.',
      },
      en: {
        term: 'Fixed cost',
        definition:
          'A cost you pay every month whatever your sales, such as rent, salaries and subscriptions.',
      },
    },
  },
  {
    id: 'startup-costs',
    category: 'costs',
    text: {
      ar: {
        term: 'تكاليف التأسيس',
        definition: 'مبالغ تُدفع مرة واحدة قبل البدء أو عنده، مثل المعدات والتسجيل والتجهيز.',
      },
      en: {
        term: 'Set-up costs',
        definition:
          'One-off amounts paid before or at launch, such as equipment, registration and fitting out.',
      },
    },
  },
  {
    id: 'cogs',
    category: 'costs',
    text: {
      ar: {
        term: 'تكلفة البضاعة المباعة',
        definition: 'مجموع التكاليف المتغيرة للوحدات التي بعتها فعلًا خلال فترة معيّنة.',
      },
      en: {
        term: 'Cost of goods sold (COGS)',
        definition: 'The total variable cost of the units you actually sold in a given period.',
      },
    },
  },
  {
    id: 'gross-profit',
    category: 'costs',
    text: {
      ar: {
        term: 'الربح الإجمالي',
        definition:
          'الإيرادات مطروحًا منها تكلفة البضاعة المباعة، قبل التكاليف التشغيلية والضرائب.',
      },
      en: {
        term: 'Gross profit',
        definition: 'Revenue minus the cost of goods sold, before operating costs and taxes.',
      },
    },
  },
  {
    id: 'pre-tax-profit',
    category: 'costs',
    text: {
      ar: {
        term: 'الربح قبل الضريبة',
        definition: 'الربح الإجمالي مطروحًا منه التكاليف التشغيلية، قبل احتساب الضريبة.',
      },
      en: {
        term: 'Pre-tax profit',
        definition: 'Gross profit minus operating costs, before tax is calculated.',
      },
    },
  },
  {
    id: 'contribution-margin',
    category: 'costs',
    text: {
      ar: {
        term: 'هامش المساهمة',
        definition:
          'ما يبقى من سعر الوحدة بعد طرح تكلفتها المتغيرة، وهو ما تساهم به كل وحدة في تغطية التكاليف الثابتة ثم في الربح.',
      },
      en: {
        term: 'Contribution margin',
        definition:
          'What is left of a unit’s price after its variable cost: what each unit contributes to covering fixed costs, and then to profit.',
      },
    },
  },
  {
    id: 'contribution-margin-ratio',
    category: 'costs',
    text: {
      ar: {
        term: 'نسبة هامش المساهمة',
        definition:
          'هامش المساهمة مقسومًا على سعر البيع، أي الجزء الذي يبقى من كل وحدة نقدية من المبيعات بعد التكلفة المتغيرة.',
      },
      en: {
        term: 'Contribution margin ratio',
        definition:
          'Contribution margin divided by the selling price: the share of each unit of sales revenue left after variable cost.',
      },
    },
  },
  {
    id: 'break-even',
    category: 'costs',
    text: {
      ar: {
        term: 'نقطة التعادل',
        definition:
          'حجم المبيعات الذي تتساوى عنده الإيرادات مع التكاليف، فلا ربح ولا خسارة. بالوحدات: التكاليف الثابتة مقسومة على هامش المساهمة للوحدة، مقرّبة إلى الأعلى.',
      },
      en: {
        term: 'Break-even point',
        definition:
          'The level of sales at which revenue equals costs, with neither profit nor loss. In units: fixed costs divided by the contribution margin per unit, rounded up.',
      },
    },
  },
  {
    id: 'price-floor',
    category: 'costs',
    text: {
      ar: {
        term: 'الحد الأدنى للسعر',
        definition:
          'أدنى سعر يغطي التكلفة المتغيرة للوحدة ونصيبها من التكاليف الثابتة عند حجم المبيعات المتوقّع. البيع تحته يعني الخسارة.',
      },
      en: {
        term: 'Price floor',
        definition:
          'The lowest price that covers a unit’s variable cost and its share of fixed costs at the expected sales volume. Selling below it means a loss.',
      },
    },
  },
  {
    id: 'penetration-pricing',
    category: 'costs',
    text: {
      ar: {
        term: 'التسعير الاختراقي',
        definition: 'دخول السوق بسعر أقل من المنافسين لكسب العملاء بسرعة، ثم رفعه تدريجيًا.',
      },
      en: {
        term: 'Penetration pricing',
        definition:
          'Entering the market below competitors’ prices to win customers quickly, then raising the price gradually.',
      },
    },
  },

  // Cash and funding
  {
    id: 'cash-flow',
    category: 'cash',
    text: {
      ar: {
        term: 'التدفق النقدي',
        definition:
          'حركة النقد الداخل إلى المشروع والخارج منه في كل فترة. قد يربح المشروع على الورق وينفد نقده إذا تأخّر تحصيل المبيعات.',
      },
      en: {
        term: 'Cash flow',
        definition:
          'The cash coming into and going out of the business in each period. A business can be profitable on paper and still run out of cash if customers pay late.',
      },
    },
  },
  {
    id: 'funding-need',
    category: 'cash',
    text: {
      ar: {
        term: 'الحاجة إلى التمويل',
        definition:
          'أكبر عجز يبلغه النقد المتراكم للمشروع قبل أن يبدأ بالتحسّن، وهو المبلغ الذي تحتاج إلى تأمينه كي لا يتوقّف المشروع.',
      },
      en: {
        term: 'Funding need',
        definition:
          'The deepest point cumulative cash reaches before it starts to recover: the amount you need to secure so the business does not stall.',
      },
    },
  },
  {
    id: 'payback-period',
    category: 'cash',
    text: {
      ar: {
        term: 'فترة الاسترداد',
        definition: 'المدة اللازمة لاستعادة تكاليف التأسيس من صافي أرباح المشروع.',
      },
      en: {
        term: 'Payback period',
        definition: 'The time needed to recover the set-up costs from the business’s net profit.',
      },
    },
  },
  {
    id: 'runway',
    category: 'cash',
    text: {
      ar: {
        term: 'مدة الصمود المالي',
        definition:
          'عدد الأشهر التي تستطيع الاستمرار فيها بما لديك من نقد قبل أن تحتاج إلى دخل أو تمويل جديد.',
      },
      en: {
        term: 'Runway',
        definition:
          'The number of months you can keep going on the cash you have before you need income or new funding.',
      },
    },
  },

  // Customers
  {
    id: 'customer-segment',
    category: 'customers',
    text: {
      ar: {
        term: 'شريحة العملاء',
        definition:
          'مجموعة محدّدة من العملاء تتشابه في حاجتها وسلوكها وقدرتها على الدفع، ويُصمَّم لها العرض والقنوات والسعر.',
      },
      en: {
        term: 'Customer segment',
        definition:
          'A defined group of customers with similar needs, behaviour and ability to pay, for whom the offer, channels and price are designed.',
      },
    },
  },
  {
    id: 'jobs-to-be-done',
    category: 'customers',
    text: {
      ar: {
        term: 'المهمة المطلوب إنجازها',
        definition:
          'طريقة لفهم العميل تسأل: ما المهمة التي «يستأجر» العميل منتجك لإنجازها؟ بدل أن تسأل عن صفاته فقط.',
      },
      en: {
        term: 'Jobs to be done',
        definition:
          'A way of understanding customers that asks what job they “hire” your product to do, rather than only who they are.',
      },
    },
  },
  {
    id: 'cac',
    category: 'customers',
    text: {
      ar: {
        term: 'تكلفة اكتساب العميل',
        definition:
          'ما تنفقه على التسويق والمبيعات للحصول على عميل جديد واحد: إنفاق الفترة مقسومًا على عدد العملاء الجدد فيها.',
      },
      en: {
        term: 'Customer acquisition cost (CAC)',
        definition:
          'What you spend on marketing and sales to win one new customer: spending in a period divided by the new customers it brought.',
      },
    },
  },
  {
    id: 'ltv',
    category: 'customers',
    text: {
      ar: {
        term: 'القيمة الدائمة للعميل',
        definition:
          'مجموع الهامش الذي يتركه العميل طوال مدة تعامله معك. في الاشتراكات: متوسط الإيراد لكل مستخدم × نسبة هامش المساهمة ÷ معدل التسرّب. وتنبّه المنصة إذا قلّت نسبتها إلى تكلفة اكتساب العميل عن 3.',
      },
      en: {
        term: 'Customer lifetime value (LTV)',
        definition:
          'The total margin a customer leaves over their whole relationship with you. For subscriptions: average revenue per user × contribution margin ratio ÷ churn rate. The platform warns when its ratio to customer acquisition cost is below 3.',
      },
    },
  },
  {
    id: 'churn',
    category: 'customers',
    text: {
      ar: {
        term: 'معدل التسرّب',
        definition: 'نسبة العملاء الذين يتوقّفون عن الشراء أو يلغون اشتراكهم خلال فترة معيّنة.',
      },
      en: {
        term: 'Churn rate',
        definition:
          'The share of customers who stop buying or cancel their subscription in a given period.',
      },
    },
  },
  {
    id: 'arpu',
    category: 'customers',
    text: {
      ar: {
        term: 'متوسط الإيراد لكل مستخدم',
        definition: 'إجمالي الإيرادات في فترة مقسومًا على عدد العملاء النشطين فيها.',
      },
      en: {
        term: 'Average revenue per user (ARPU)',
        definition: 'Total revenue in a period divided by the number of active customers in it.',
      },
    },
  },

  // Market and analysis
  {
    id: 'tam',
    category: 'market',
    text: {
      ar: {
        term: 'السوق الكلي',
        definition:
          'إجمالي الإنفاق السنوي على نوع منتجك في السوق كلها، لو حصلت على كل العملاء الممكنين.',
      },
      en: {
        term: 'Total addressable market (TAM)',
        definition:
          'Total yearly spending on your kind of product across the whole market, if you won every possible customer.',
      },
    },
  },
  {
    id: 'sam',
    category: 'market',
    text: {
      ar: {
        term: 'السوق القابل للخدمة',
        definition: 'جزء السوق الكلي الذي يقع ضمن نطاقك الجغرافي وشريحتك المستهدفة.',
      },
      en: {
        term: 'Serviceable available market (SAM)',
        definition: 'The part of the total market within your geographic scope and target segment.',
      },
    },
  },
  {
    id: 'som',
    category: 'market',
    text: {
      ar: {
        term: 'الحصة القابلة للتحقيق',
        definition:
          'الجزء الذي تستطيع الوصول إليه فعلًا في المدى القريب بقنواتك وطاقتك. يُحسب من الأسفل: العملاء الذين تصل إليهم × نسبة التحويل × تكرار الشراء × السعر.',
      },
      en: {
        term: 'Serviceable obtainable market (SOM)',
        definition:
          'The part you can realistically reach in the near term with your channels and capacity. Calculated from the bottom up: customers you can reach × conversion rate × purchase frequency × price.',
      },
    },
  },
  {
    id: 'substitute',
    category: 'market',
    text: {
      ar: {
        term: 'البديل',
        definition:
          'أي طريقة يحلّ بها العميل مشكلته اليوم من دونك، ولو لم تكن منتجًا منافسًا مباشرًا، مثل الحل اليدوي أو عدم فعل شيء.',
      },
      en: {
        term: 'Substitute',
        definition:
          'Any way the customer solves the problem today without you, even if it is not a direct competitor, such as doing it by hand or doing nothing.',
      },
    },
  },
  {
    id: 'seasonality',
    category: 'market',
    text: {
      ar: {
        term: 'الموسمية',
        definition:
          'تغيّر الطلب بانتظام حسب أشهر السنة أو المواسم، مثل الأعياد وبداية العام الدراسي.',
      },
      en: {
        term: 'Seasonality',
        definition:
          'Regular changes in demand across the months or seasons of the year, such as holidays or the start of the school year.',
      },
    },
  },
  {
    id: 'scenario-analysis',
    category: 'market',
    text: {
      ar: {
        term: 'تحليل السيناريوهات',
        definition:
          'إعادة حساب النتائج في حالات مختلفة، عادةً متحفّظة وأساسية ومتفائلة، لمعرفة مدى تحمّل النموذج.',
      },
      en: {
        term: 'Scenario analysis',
        definition:
          'Recalculating results under different cases, usually conservative, base and optimistic, to see how much the model can take.',
      },
    },
  },
  {
    id: 'sensitivity-analysis',
    category: 'market',
    text: {
      ar: {
        term: 'تحليل الحساسية',
        definition:
          'تغيير متغيّر واحد في كل مرة، مثل السعر أو التكلفة، لمعرفة أيّ المتغيرات يؤثّر أكثر في النتيجة.',
      },
      en: {
        term: 'Sensitivity analysis',
        definition:
          'Changing one variable at a time, such as price or cost, to find which one affects the result most.',
      },
    },
  },
  {
    id: 'pestel',
    category: 'market',
    text: {
      ar: {
        term: 'تحليل PESTEL',
        definition:
          'مراجعة العوامل الخارجية المؤثّرة في المشروع: السياسية، والاقتصادية، والاجتماعية، والتقنية، والبيئية، والقانونية.',
      },
      en: {
        term: 'PESTEL analysis',
        definition:
          'A review of the outside factors that affect a business: political, economic, social, technological, environmental and legal.',
      },
    },
  },
  {
    id: 'five-forces',
    category: 'market',
    text: {
      ar: {
        term: 'قوى بورتر الخمس',
        definition:
          'إطار لتقدير شدّة المنافسة في قطاع: المنافسون الحاليون، والداخلون الجدد، والبدائل، وقوة المورّدين التفاوضية، وقوة المشترين التفاوضية.',
      },
      en: {
        term: 'Porter’s five forces',
        definition:
          'A framework for judging how intense competition is in a sector: existing rivals, new entrants, substitutes, and the bargaining power of suppliers and of buyers.',
      },
    },
  },
  {
    id: 'swot',
    category: 'market',
    text: {
      ar: {
        term: 'تحليل SWOT',
        definition:
          'جدول يجمع نقاط القوة والضعف الداخلية مع الفرص والتهديدات الخارجية. في المنصة، كل بند يحتاج إلى دليل من إجاباتك أو من مصدر، وإلا حُذف.',
      },
      en: {
        term: 'SWOT analysis',
        definition:
          'A table of internal strengths and weaknesses alongside external opportunities and threats. On the platform, every item needs evidence from your answers or a source, or it is dropped.',
      },
    },
  },
];
