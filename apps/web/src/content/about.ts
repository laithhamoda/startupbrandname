import 'server-only';
import type { Localized, TitledText } from './types';

export interface AboutContent {
  heading: string;
  lead: string;
  whatHeading: string;
  what: string;
  principlesHeading: string;
  principles: readonly TitledText[];
  audienceHeading: string;
  audience: string;
}

// Nothing about the founder or the operating entity is published until the owner provides it
// (docs/OPEN-QUESTIONS.md). The page describes the platform only.
export const ABOUT: Localized<AboutContent> = {
  ar: {
    heading: 'عن المنصة',
    lead: 'منصة عربية مستقلة تساعد المؤسسين على تحويل الفكرة إلى نموذج عمل مدروس، بأرقام محسوبة ومصادر مؤرّخة وحكم واضح.',
    whatHeading: 'ما هي',
    what: 'استوديو لنموذج العمل: تشخيص منظّم لفكرة مشروعك، ومحرّك يحسب الأرقام، وتقرير عربي بحكم واضح، ومرشد ذكي ينتقد ولا يجامل.',
    principlesHeading: 'مبادئنا',
    principles: [
      {
        title: 'العربية أولًا',
        body: 'الواجهة والتقرير بالعربية الفصحى، ونفهم إجاباتك بلهجتك.',
      },
      {
        title: 'الأرقام تُحسب ولا تُكتب',
        body: 'لا يظهر في التقرير رقم لم يخرج من معادلة مختبرة.',
      },
      {
        title: 'لكل معلومة مصدر',
        body: 'إجابتك، أو افتراض معلن، أو مصدر خارجي برابطه وتاريخه.',
      },
      {
        title: 'لا نخترع',
        body: 'لا أحجام أسواق ولا إحصاءات ولا أسماء شركات دون مصدر موثوق. وإن لم نجد مصدرًا تركنا الحقل فارغًا وذكرنا السبب.',
      },
      {
        title: 'الخصوصية بالتصميم',
        body: 'بياناتك في الاتحاد الأوروبي، في فرانكفورت، ولا يصل اسمك أو بريدك إلى نموذج الذكاء الاصطناعي.',
      },
      {
        title: 'الوضوح',
        body: 'حكم صريح في نهاية كل تقرير، حتى حين لا يكون ما تتمنّى سماعه.',
      },
    ],
    audienceHeading: 'لمن',
    audience:
      'للمؤسسين الناطقين بالعربية في أي مرحلة: فكرة أولى، أو مشروع قائم يحتاج إلى مراجعة أرقامه، أو متدرّب يعدّ نموذج عمل لدورة تدريبية.',
  },
  en: {
    heading: 'About',
    lead: 'An independent Arabic platform that helps founders turn an idea into a well-examined business model, with calculated numbers, dated sources and a clear verdict.',
    whatHeading: 'What it is',
    what: 'A business model studio: a structured diagnostic of your idea, an engine that calculates the numbers, an Arabic report with a clear verdict, and an AI mentor that challenges rather than flatters.',
    principlesHeading: 'Our principles',
    principles: [
      {
        title: 'Arabic first',
        body: 'The interface and the report are in Modern Standard Arabic, and we understand your answers in your own dialect.',
      },
      {
        title: 'Numbers are calculated, not written',
        body: 'No number appears in a report unless it came out of a tested formula.',
      },
      {
        title: 'Every fact has a source',
        body: 'Your answer, a declared assumption, or an external source with its link and date.',
      },
      {
        title: 'Nothing invented',
        body: 'No market sizes, statistics or company names without a reliable source. If we find none, we leave the field empty and say why.',
      },
      {
        title: 'Privacy by design',
        body: 'Your data stays in the European Union, in Frankfurt, and your name and email never reach the AI model.',
      },
      {
        title: 'Clarity',
        body: 'A plain verdict at the end of every report, even when it is not what you hoped to hear.',
      },
    ],
    audienceHeading: 'Who it is for',
    audience:
      'Arabic-speaking founders at any stage: a first idea, an existing business that needs its numbers checked, or a trainee preparing a business model for a course.',
  },
};
