import { option } from '../options';
import { define, t } from './define';

// G — الإطار القانوني. Orientation only: the registration guide (T17) gives the sourced path.
export const AXIS_G = [
  define({
    id: 'G1',
    allowUnknown: false,
    field: {
      kind: 'single',
      options: [
        option('sole', 'مؤسسة فردية', 'Sole proprietorship'),
        option('company', 'شركة', 'Company'),
        option('dont_know', 'لا أعرف بعد', 'Not sure yet'),
      ],
    },
    label: t('ما الشكل القانوني الذي تفكر فيه؟', 'Which legal form are you considering?'),
    help: t(
      'إن لم تعرف، نعرض لك مقارنة من بيانات دولتك.',
      'If you are not sure, we show you a comparison from your country’s data.',
    ),
  }),
  define({
    id: 'G2',
    field: {
      kind: 'single',
      options: [
        option('yes', 'نعم', 'Yes'),
        option('in_progress', 'قيد التسجيل', 'In progress'),
        option('no', 'لا', 'No'),
      ],
    },
    label: t('هل المشروع مسجّل حالياً؟', 'Is the project registered now?'),
    help: t(
      'التسجيل الرسمي لدى الجهة المختصة في دولتك.',
      'Official registration with the relevant authority in your country.',
    ),
  }),
  define({
    id: 'G3',
    field: { kind: 'boolean' },
    label: t('هل تعمل حالياً دون ترخيص؟', 'Are you operating without a licence right now?'),
    help: t(
      'سؤال لتخطيط مسار التنظيم، لا للّوم.',
      'This is to plan your path to regularise, not to blame.',
    ),
  }),
  define({
    id: 'G4',
    field: { kind: 'percent_split' },
    label: t('كيف تتوزع الملكية بين الشركاء؟', 'How is ownership split between the partners?'),
    help: t(
      'مجموع النسب 100%. إن كنت وحدك، اكتب اسمك بنسبة 100%.',
      'The shares add up to 100%. If you are alone, enter your name at 100%.',
    ),
  }),
  define({
    id: 'G5',
    field: {
      kind: 'single',
      options: [
        option('registered', 'نعم، مسجّل', 'Yes, registered'),
        option('unregistered', 'لدي اسم غير مسجّل', 'I have a name, not registered'),
        option('none', 'ليس بعد', 'Not yet'),
      ],
    },
    label: t('هل لديك اسم تجاري أو علامة محمية؟', 'Do you have a trade name or a protected mark?'),
    help: t(
      'التسجيل يحمي الاسم من استخدام غيرك له.',
      'Registering protects the name from being used by others.',
    ),
  }),
  define({
    id: 'G6',
    star: true,
    field: { kind: 'boolean' },
    label: t(
      'هل بلغت سن الأهلية القانونية لتسجيل منشأة في بلدك؟',
      'Have you reached the legal age to register a business in your country?',
    ),
    help: t(
      'لا نسأل عن عمرك؛ نحتاج فقط إلى اختيار المسار المناسب لك.',
      'We do not ask your age; we only need to choose the right path for you.',
    ),
  }),
  define({
    id: 'G7',
    field: {
      kind: 'single',
      options: [
        option('yes', 'نعم', 'Yes'),
        option('no_preference', 'لا يهم', 'No preference'),
        option('no', 'لا', 'No'),
      ],
    },
    label: t('هل تفضّل تمويلاً متوافقاً مع الشريعة؟', 'Do you prefer Sharia-compliant financing?'),
    help: t(
      'إن اخترت نعم، نقترح أدوات تمويل متوافقة فقط.',
      'If you choose yes, we suggest compliant financing instruments only.',
    ),
  }),
  define({
    id: 'G8',
    field: {
      kind: 'single',
      options: [
        option('yes', 'نعم', 'Yes'),
        option('partly', 'جزئيًا', 'Partly'),
        option('no', 'لا', 'No'),
      ],
    },
    label: t('هل تعرف التزاماتك الضريبية؟', 'Do you know your tax obligations?'),
    help: t(
      'نعرض لك قائمة تحقّق من مصادر رسمية مؤرّخة.',
      'We show you a checklist from dated official sources.',
    ),
  }),
] as const;
