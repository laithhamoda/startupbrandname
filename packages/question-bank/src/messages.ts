import type { Text } from './types';

/**
 * What the platform says when a check fires. Firm, never insulting, and always with a way
 * forward (docs/SPEC.md §2). R1, R2, R5 and R8 keep the SPEC wording. `{word}` is filled in.
 */
export const MESSAGES = {
  R1_everyone: {
    ar: 'المشروع الذي يستهدف الجميع لا يصل إلى أحد. من أول 10 عملاء سيدفعون لك؟',
    en: 'A project aimed at everyone reaches no one. Who are the first 10 customers who will pay you?',
  },
  R2_no_competitors: {
    ar: 'كيف يتصرف العميل اليوم دونك؟ هذا هو منافسك.',
    en: 'How does the customer manage today without you? That is your competitor.',
  },
  R2_no_alternative: {
    ar: 'لا بد أن الناس يتصرّفون بطريقة ما اليوم، ولو بالتحمّل أو بحلّ يدوي. كيف يتصرّفون؟',
    en: 'People must be coping somehow today, even by putting up with it or doing it by hand. How?',
  },
  R3_not_numeric: {
    ar: 'لم نتمكّن من قراءة رقم. اكتب الرقم وحده، أو اختر النطاق الأقرب.',
    en: 'We could not read a number. Type the number on its own, or pick the closest range.',
  },
  R3_range: {
    ar: 'اكتب رقمًا واحدًا، أو اختر أحد النطاقات المقترحة.',
    en: 'Type a single number, or pick one of the suggested ranges.',
  },
  R3_ambiguous: {
    ar: 'لم نتأكّد من قراءة هذا الرقم. اكتبه بالأرقام وحدها، مثل 1500 أو 12.5، أو اختر النطاق الأقرب.',
    en: 'We could not be sure how to read this number. Type it in digits only, such as 1500 or 12.5, or pick the closest range.',
  },
  R3_two_readings: {
    ar: 'يمكن قراءة «{word}» بطريقتين. أيّهما تقصد؟',
    en: '“{word}” can be read in two ways. Which do you mean?',
  },
  R4_unknown_text: {
    ar: 'يبدو أنك لا تعرف الإجابة بعد. هل نحفظها «لا أعرف»؟ ستصبح افتراضًا نختبره في خطة التحقّق.',
    en: 'It looks like you do not know yet. Save it as “I don’t know”? It becomes an assumption to test in the validation plan.',
  },
  R5_vague: {
    ar: 'أفضل بكم؟ أسرع بكم يومًا أو ساعة؟ أعطني رقمًا.',
    en: 'Better by how much? Faster by how many days or hours? Give me a number.',
  },
  R7_too_short: {
    ar: 'أعطني مثالًا واحدًا حقيقيًا.',
    en: 'Give me one real example.',
  },
  R8_solution: {
    ar: 'هذا حلّك. ما الألم الذي يشعر به العميل قبل أن يعرفك؟',
    en: 'That is your solution. What pain does the customer feel before they know you?',
  },
  R6_interviews_vs_payment: {
    ar: 'ذكرت أن عميلًا دفع أو وعد بالدفع، لكنك لم تتحدث مع أحد عن المشكلة. أيهما أدق؟',
    en: 'You say a customer paid or promised to, but also that you have talked to no one about the problem. Which is right?',
  },
  R6_sales_vs_capacity: {
    ar: 'مبيعات الشهر الأول أكبر من أقصى ما تستطيع خدمته شهريًا. أيهما نعدّل؟',
    en: 'Month-one sales exceed the most you can serve in a month. Which should change?',
  },
  R6_team_vs_ownership: {
    ar: 'ذكرت أنك تعمل وحدك، لكن الملكية موزّعة على أكثر من شريك. أيهما أدق؟',
    en: 'You say you work alone, but ownership is split between several partners. Which is right?',
  },
  R6_breakeven_vs_runway: {
    ar: 'تقبل مدة طويلة للوصول إلى التعادل، لكنك لا تستطيع الاستمرار دون دخل إلا مدة أقصر. أيهما نعدّل؟',
    en: 'You accept a long time to break even, but can only go without income for a shorter time. Which should change?',
  },
  A3_everything: {
    ar: 'لا أحد يتقن كل شيء. اختر المهارات التي مارستها فعلًا في عمل أو مشروع.',
    en: 'No one masters everything. Choose the skills you have actually used in a job or project.',
  },
  A6_low_hours: {
    ar: 'أقل من 10 ساعات أسبوعيًا تعني أن كل خطوة ستأخذ وقتًا أطول، وسيظهر ذلك في الجدول الزمني.',
    en: 'Under 10 hours a week means every step takes longer, and the timeline will show it.',
  },
  B1_too_long: {
    ar: 'اختصرها إلى 40 كلمة على الأكثر: ماذا، ولمن، ولماذا.',
    en: 'Cut it to 40 words at most: what, for whom, and why.',
  },
  B1_unclear: {
    ar: 'لم تتضح الفكرة بعد. صفها في جملة واحدة: ماذا تقدّم، ولمن، ولماذا؟',
    en: 'The idea is not clear yet. Describe it in one sentence: what you offer, to whom, and why.',
  },
  B1_one_sentence: {
    ar: 'في جملة واحدة فقط، من فضلك.',
    en: 'In one sentence only, please.',
  },
  B5_untested: {
    ar: 'لم تتحدث مع أحد بعد، فالمشكلة «غير مُختبَرة». أضفنا مهمة مقابلات إلى خطة التحقّق.',
    en: 'You have not talked to anyone yet, so the problem is untested. We added an interview task to your validation plan.',
  },
  B8_nobody: {
    ar: 'كل فكرة يمكن نسخها. ما الذي سيجعل نسخ فكرتك صعبًا أو مكلفًا؟',
    en: 'Any idea can be copied. What would make copying yours hard or costly?',
  },
  C2_incomplete: {
    ar: 'أكمل وصف عميلك الأول: {word}.',
    en: 'Complete the description of your first customer: {word}.',
  },
  D1_focus: {
    ar: 'العمل في أكثر من دولة منذ السنة الأولى يشتّت الموارد. هل تستطيع البدء بدولة واحدة؟',
    en: 'Several countries in year one spreads your resources thin. Could you start with one?',
  },
  E4_single_supplier: {
    ar: 'الاعتماد على مورّد واحد خطر. هل يوجد بديل واحد على الأقل؟',
    en: 'Relying on one supplier is a risk. Is there at least one alternative?',
  },
  F3_exceeds_price: {
    ar: 'التكلفة المتغيرة للوحدة تساوي سعر البيع أو تزيد عليه: كل وحدة تبيعها تخسر فيها. راجع السعر أو التكاليف قبل المتابعة.',
    en: 'The variable cost per unit equals or exceeds the selling price: you lose money on every unit. Review the price or the costs before you continue.',
  },
  F4_zero: {
    ar: 'لا يوجد مشروع بلا تكاليف ثابتة. فكّر في الاتصالات والاشتراكات والمواصلات.',
    en: 'No business has zero fixed costs. Think of phone and internet, subscriptions and transport.',
  },
  F5_exceeds_capital: {
    ar: 'تكاليف التأسيس أكبر من رأس المال المتاح، فسؤال التمويل (H3) أصبح ضروريًا.',
    en: 'Set-up costs exceed the capital you have, so the funding question (H3) is now essential.',
  },
  G4_no_agreement: {
    ar: 'دون اتفاق مكتوب بين الشركاء، قد يوقف أي خلاف المشروع. ننصح بتوثيق الاتفاق.',
    en: 'Without a written agreement between partners, any dispute can stop the project. We advise putting it in writing.',
  },
  G6_later_path: {
    ar: 'سنقترح مسارًا يبدأ دون تسجيل، ثم التسجيل حين تبلغ السن القانونية.',
    en: 'We will suggest a path that starts without registration, then registers once you reach the legal age.',
  },
  H1_not_measurable: {
    ar: 'اجعل هدفك قابلًا للقياس برقم: كم عميلًا، أو كم مبيعات، أو بأي تاريخ.',
    en: 'Make the goal measurable with a number: how many customers, how much in sales, or by what date.',
  },
  currency_ambiguous: {
    ar: 'أي عملة تقصد؟ كلمة «{word}» تُستخدم لأكثر من عملة.',
    en: 'Which currency do you mean? “{word}” is used for more than one currency.',
  },
  currency_centimes: {
    ar: 'هل المبلغ بالدينار أم بالسنتيم؟ في الاستعمال اليومي تعني «مليون» غالبًا 10,000 دينار جزائري.',
    en: 'Is this amount in dinars or centimes? In everyday use, «مليون» often means 10,000 Algerian dinars.',
  },
} as const satisfies Record<string, Text>;

export type FindingCode = keyof typeof MESSAGES;

/** The message for a finding, with `{word}` filled in. */
export function message(code: FindingCode, language: 'ar' | 'en', word?: string): string {
  const template: string = MESSAGES[code][language];
  return word === undefined ? template : template.replace('{word}', word);
}
