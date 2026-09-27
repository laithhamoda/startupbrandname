import {
  type Answer,
  completeness,
  getQuestion,
  type QuestionId,
  questionsFor,
  reviewAnswer,
  reviewProject,
} from '@sbn/question-bank';
import { sampleAnswers, sampleValue } from '@sbn/question-bank/testing';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { FieldPreview } from '@/components/diagnostic/field-preview';
import { FindingList } from '@/components/diagnostic/finding-list';
import { AxisProgress, CompletenessPanel } from '@/components/diagnostic/progress';
import { getServerEnv } from '@/env/server';
import { currentLocale } from '@/i18n/locale';
import { countryOptions } from '@/lib/countries';
import { currencyOptions } from '@/lib/diagnostic/currencies';
import { toDraft } from '@/lib/diagnostic/draft';
import { viewFinding } from '@/lib/diagnostic/findings';

const TITLE = { ar: 'معرض التشخيص', en: 'Diagnostic gallery' } as const;
const LEAD = {
  ar: 'مكوّنات أسئلة التشخيص بإجابات نموذجية، للمراجعة البصرية ولقطات الواجهة. لا تُحفظ فيها أي إجابة.',
  en: 'The diagnostic question components with sample answers, for visual review and snapshots. Nothing here is saved.',
} as const;

/** One of each kind that looks different: text, number, choices, amounts, lists, the profile. */
const SHOWCASE: readonly QuestionId[] = [
  'B1',
  'A6',
  'C1',
  'C7',
  'F1',
  'A5',
  'F3',
  'D4',
  'C2',
  'D7',
  'G4',
  'F6',
];

export async function generateMetadata(): Promise<Metadata> {
  return { title: TITLE[await currentLocale()], robots: { index: false, follow: false } };
}

// Internal page, like /design: never on the production deployment.
export default async function DiagnosticGalleryPage() {
  if (getServerEnv().VERCEL_ENV === 'production') notFound();
  const locale = await currentLocale();

  const quick = sampleAnswers(questionsFor('quick').map((question) => question.id));
  const answered = (value: unknown): Answer => ({ status: 'answered', value });
  const findings = [
    ...reviewAnswer('B3', answered('الجميع')),
    ...reviewProject({
      ...quick,
      F3: answered({ items: [{ label: 'قطع', amount: 30, currency: 'JOD' }] }),
      A7: answered('lt3'),
      H5: answered('m12'),
    }),
  ].map((finding) => viewFinding(finding, locale));
  const options = {
    countries: countryOptions(locale),
    currencies: currencyOptions(locale),
    currency: 'JOD',
    payer: 'b2b',
  };
  const context = {
    currency: 'JOD',
    country: 'JO',
    competitors: ['فنّي مستقل', 'شركة صيانة كبيرة'],
  };

  return (
    <div className="mx-auto grid max-w-[75rem] gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-16">
      <div className="grid content-start gap-8">
        <header className="grid gap-3">
          <h1 className="text-h1 font-extrabold">{TITLE[locale]}</h1>
          <p className="reading text-muted">{LEAD[locale]}</p>
          <AxisProgress byAxis={completeness(quick).byAxis} current="F" language={locale} />
        </header>

        {SHOWCASE.map((id) => {
          const question = getQuestion(id);
          return (
            <section
              key={id}
              aria-labelledby={`${id}-heading`}
              className="grid gap-4 border-t border-hairline pt-6"
            >
              <h2 id={`${id}-heading`} className="reading text-h3 font-bold">
                {question.label[locale]}
              </h2>
              <p id={`${id}-help`} className="reading text-small text-ink-2">
                {question.help[locale]}
              </p>
              <FieldPreview
                id={`preview-${id}`}
                labelledBy={`${id}-heading`}
                describedBy={`${id}-help`}
                field={question.field}
                initialDraft={toDraft(
                  question.field,
                  id === 'F1' ? undefined : sampleValue(question.field),
                  context,
                )}
                options={options}
              />
            </section>
          );
        })}

        <section
          aria-labelledby="findings-heading"
          className="grid gap-4 border-t border-hairline pt-6"
        >
          <h2 id="findings-heading" className="text-h3 font-bold">
            {locale === 'ar' ? 'رسائل القواعد' : 'Rule messages'}
          </h2>
          <FindingList findings={findings} />
        </section>
      </div>
      <aside>
        <CompletenessPanel result={completeness(quick)} language={locale} />
      </aside>
    </div>
  );
}
