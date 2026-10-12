import type { Answer, Answers, StepId } from '@sbn/question-bank';
import { sampleAnswers } from '@sbn/question-bank/testing';
import {
  type BlockId,
  buildBusinessModelCanvas,
  buildLeanCanvas,
  CANVAS_MAP,
  type CanvasInput,
  type ChipProvenance,
} from '@sbn/report/canvas';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { CanvasBoard } from '@/components/canvas/canvas-board';
import { getServerEnv } from '@/env/server';
import { currentLocale } from '@/i18n/locale';

const TITLE = { ar: 'معرض اللوحتين', en: 'Canvas gallery' } as const;
const LEAD = {
  ar: 'لوحة نموذج العمل واللوحة الرشيقة بإجابات نموذجية: علامات المصدر الثلاث، ونصّ طويل، وإجابة «لا أعرف»، ومربعات فارغة. للمراجعة البصرية فقط، ولا تُحفظ فيها أي إجابة.',
  en: 'The Business Model Canvas and the Lean Canvas with sample answers: the three provenance marks, a long text, an “I don’t know” answer and empty boxes. For visual review only: nothing here is saved.',
} as const;
const SECTIONS = {
  ar: {
    business_model: 'لوحة نموذج العمل',
    lean: 'اللوحة الرشيقة',
    empty: 'مشروع بلا إجابات',
  },
  en: {
    business_model: 'Business Model Canvas',
    lean: 'Lean Canvas',
    empty: 'A project with no answers',
  },
} as const;

export async function generateMetadata(): Promise<Metadata> {
  return { title: TITLE[await currentLocale()], robots: { index: false, follow: false } };
}

const answered = (value: unknown): Answer => ({ status: 'answered', value });

/** A text long enough to be cut off in a box, in the founder's own words. */
const LONG_PROBLEM =
  'تتعطّل مكيّفات المطاعم الصغيرة في أشهر الصيف فيتوقف المطبخ يومين أو ثلاثة أيام في كل مرة، وتخسر المطاعم مبيعاتها ويضيع على أصحابها أجر العاملين، ولا يجد صاحب المطعم فنّيًا يثق به ويأتي في الوقت المناسب، ولا يعرف كم سيدفع قبل أن يصل الفنّي، فيؤجّل الصيانة إلى أن يقع العطل الكبير.';

/** Provenance of the three kinds: the founder's answer, an assumption, an external source. */
const USER: ChipProvenance = { source: 'user', confidence: 'medium', validated: false };
const ASSUMPTION: ChipProvenance = { source: 'assumption', confidence: 'low', validated: false };
const EXTERNAL: ChipProvenance = { source: 'external', confidence: 'high', validated: true };
const MARKS: Partial<Record<StepId, ChipProvenance>> = {
  F1: EXTERNAL,
  D5: ASSUMPTION,
  F3: ASSUMPTION,
};

function fixture(language: 'ar' | 'en'): CanvasInput {
  const answers: Answers = {
    ...sampleAnswers(),
    B2: answered(LONG_PROBLEM),
    'C7.1': answered('متابعة بعد أسبوع من التسليم'),
    'F4.1': answered({ amount: 120, currency: 'JOD' }),
    F3: answered({
      items: [
        { label: 'قطع غيار', amount: 8, currency: 'JOD' },
        { label: 'نقل', amount: 1.5, currency: 'JOD' },
      ],
    }),
    // An unknown answer gives a box with no chip and its reason.
    H2: { status: 'unknown' },
    H1: { status: 'unknown' },
  };
  // No answer for the unfair advantage: the other kind of empty box.
  delete answers.B8;
  const provenance: Partial<Record<StepId, ChipProvenance>> = {};
  for (const id of Object.keys(answers) as StepId[]) {
    provenance[id] = MARKS[id] ?? USER;
  }
  const label = (code: string) => (language === 'ar' && code === 'JOD' ? 'د.أ' : code);
  return {
    language,
    answers,
    provenance,
    currencyLabel: label,
    totals: [
      { kind: 'fixedMonthly', text: `120 ${label('JOD')}`, provenance: USER },
      { kind: 'variableUnit', text: `9.5 ${label('JOD')}`, provenance: ASSUMPTION },
      { kind: 'setup', text: `1500 ${label('JOD')}`, provenance: USER },
    ],
  };
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="grid gap-4 border-t border-hairline pt-6">
      <h2 id={id} className="text-h3 font-bold">
        {title}
      </h2>
      {children}
    </section>
  );
}

// Internal page, like /design: never on the production deployment (D-058).
export default async function CanvasGalleryPage() {
  if (getServerEnv().VERCEL_ENV === 'production') notFound();
  const locale = await currentLocale();
  const input = fixture(locale);
  const empty: CanvasInput = {
    language: locale,
    answers: {},
    provenance: {},
    currencyLabel: (c) => c,
  };
  // Nothing is saved here, so every chip leads to the other gallery page.
  const hrefFor = () => '/design/diagnostic';
  const bmcBlocks: BlockId[] = CANVAS_MAP.business_model.map((block) => block.id);
  const leanOnly = CANVAS_MAP.lean.map((block) => block.id).filter((id) => !bmcBlocks.includes(id));
  const names = SECTIONS[locale];

  return (
    <div className="mx-auto grid max-w-[90rem] gap-8 px-4 py-10 sm:px-6">
      <header className="grid gap-3">
        <h1 className="text-h1 font-extrabold">{TITLE[locale]}</h1>
        <p className="reading text-muted">{LEAD[locale]}</p>
      </header>
      <Section id="gallery-bmc" title={names.business_model}>
        <CanvasBoard
          model={buildBusinessModelCanvas(input)}
          hrefFor={hrefFor}
          idPrefix="gallery-bmc"
          englishTerms={bmcBlocks}
        />
      </Section>
      <Section id="gallery-lean" title={names.lean}>
        <CanvasBoard
          model={buildLeanCanvas(input)}
          hrefFor={hrefFor}
          idPrefix="gallery-lean"
          englishTerms={leanOnly}
        />
      </Section>
      <Section id="gallery-empty" title={names.empty}>
        <CanvasBoard
          model={buildBusinessModelCanvas(empty)}
          hrefFor={hrefFor}
          idPrefix="gallery-empty"
        />
      </Section>
    </div>
  );
}
