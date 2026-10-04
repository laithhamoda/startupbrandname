import { option } from '../options';
import { define, t } from './define';

// A — المؤسس والموارد. Arabic labels are SPEC §1 verbatim (D-106).
export const AXIS_A = [
  define({
    id: 'A1',
    star: true,
    allowUnknown: false,
    field: { kind: 'country_city' },
    label: t('في أي دولة ومدينة ستعمل؟', 'In which country and city will you operate?'),
    help: t(
      'الدولة تحدّد بيانات التسجيل والضرائب في تحليلك. مثال: الأردن، إربد.',
      'The country decides the registration and tax data in your analysis. Example: Jordan, Irbid.',
    ),
  }),
  define({
    id: 'A2',
    field: {
      kind: 'number',
      min: 0,
      max: 60,
      integer: true,
      ranges: [
        { min: 0, max: 0 },
        { min: 1, max: 2 },
        { min: 3, max: 5 },
        { min: 6, max: 10 },
        { min: 10 },
      ],
    },
    label: t(
      'كم سنة خبرة لديك في هذا القطاع تحديداً؟',
      'How many years of experience do you have in this specific sector?',
    ),
    help: t(
      'خبرة العمل في القطاع نفسه، لا الخبرة العامة. اكتب 0 إن لم تعمل فيه بعد.',
      'Work experience in this very sector, not in general. Enter 0 if you have not worked in it yet.',
    ),
  }),
  define({
    id: 'A3',
    field: {
      kind: 'multi',
      other: true,
      options: [
        option('sales', 'البيع', 'Sales'),
        option('marketing', 'التسويق', 'Marketing'),
        option('operations', 'إدارة العمليات', 'Operations'),
        option('finance', 'المالية والمحاسبة', 'Finance and accounting'),
        option('technology', 'التقنية والبرمجة', 'Technology and software'),
        option('design', 'التصميم', 'Design'),
        option('production', 'الإنتاج أو الحِرفة', 'Production or craft'),
        option('customer_service', 'خدمة العملاء', 'Customer service'),
        option('management', 'الإدارة وقيادة الفريق', 'Management and leading a team'),
        option('languages', 'اللغات', 'Languages'),
      ],
    },
    label: t(
      'ما المهارات التي تملكها وتخدم المشروع مباشرة؟',
      'Which of your skills serve the project directly?',
    ),
    help: t(
      'اختر ما مارسته فعلًا في عمل أو مشروع، وأضف غيره إن وُجد.',
      'Choose what you have actually used in a job or project, and add others if needed.',
    ),
  }),
  define({
    id: 'A4',
    field: {
      kind: 'people',
      minItems: 0,
      // No name is asked for (data minimisation): a people field is not sent to the AI review
      // today, but the mentor and the report will read the answers later (D-148).
      labels: {
        name: t('الدور أو الصفة (لا حاجة إلى الاسم)', 'Role or title (no name needed)'),
        detail: t('المسؤولية', 'Responsibility'),
      },
    },
    label: t(
      'هل لديك فريق أو شركاء؟ اذكر أدوارهم',
      'Do you have a team or partners? List their roles.',
    ),
    help: t(
      'مثال: شريك، مسؤول عن الإنتاج. اترك القائمة فارغة إن كنت تعمل وحدك.',
      'Example: a partner in charge of production. Leave the list empty if you work alone.',
    ),
  }),
  define({
    id: 'A5',
    field: { kind: 'money_range' },
    label: t('ما رأس المال المتاح لديك الآن؟', 'How much capital do you have available now?'),
    help: t(
      'المال الذي تستطيع وضعه في المشروع فعلًا، كنطاق من كذا إلى كذا، مع العملة.',
      'The money you can actually put into the project, as a range from–to, with the currency.',
    ),
  }),
  define({
    id: 'A6',
    field: {
      kind: 'number',
      min: 0,
      max: 120,
      integer: false,
      ranges: [
        { min: 0, max: 5 },
        { min: 5, max: 10 },
        { min: 10, max: 20 },
        { min: 20, max: 40 },
        { min: 40 },
      ],
    },
    label: t('كم ساعة أسبوعياً ستخصص للمشروع؟', 'How many hours a week will you give the project?'),
    help: t(
      'احسب الساعات الفعلية بعد عملك والتزاماتك الأخرى.',
      'Count the real hours left after your job and other commitments.',
    ),
  }),
  define({
    id: 'A7',
    field: {
      kind: 'single',
      options: [
        option('lt3', 'أقل من 3 أشهر', 'Less than 3 months'),
        option('3to6', 'من 3 إلى 6 أشهر', '3 to 6 months'),
        option('6to12', 'من 6 إلى 12 شهرًا', '6 to 12 months'),
        option('gt12', 'أكثر من 12 شهرًا', 'More than 12 months'),
      ],
    },
    label: t(
      'إلى متى تستطيع الاستمرار دون دخل من المشروع؟',
      'How long can you keep going without income from the project?',
    ),
    help: t(
      'دون أن تضطر إلى إيقاف المشروع أو الاقتراض لمصاريفك الشخصية.',
      'Without having to stop the project or borrow for your personal expenses.',
    ),
  }),
  define({
    id: 'A8',
    star: true,
    field: {
      kind: 'single',
      options: [
        option('side_income', 'دخل إضافي', 'Side income'),
        option('main_income', 'دخل رئيسي', 'Main income'),
        option('scalable_company', 'شركة قابلة للنمو', 'A company that can scale'),
      ],
    },
    label: t('ما هدفك من المشروع؟', 'What is your goal for the project?'),
    help: t('يحدّد عمق التحليل ونبرته.', 'It sets the depth and tone of the analysis.'),
  }),
] as const;
