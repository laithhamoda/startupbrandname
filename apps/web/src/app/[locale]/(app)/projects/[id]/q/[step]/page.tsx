import {
  AXIS_NAMES,
  completeness,
  diagnosticSequence,
  FOLLOW_UPS,
  getQuestion,
  isQuestionId,
  positionInAxis,
  previousStep,
  reviewAnswer,
  reviewProject,
  valueOf,
} from '@sbn/question-bank';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { notFound, redirect } from 'next/navigation';
import { AnswerEditor } from '@/components/diagnostic/answer-editor';
import { AxisProgress, CompletenessPanel } from '@/components/diagnostic/progress';
import { TextLink } from '@/components/ui/text-link';
import { currentLocale } from '@/i18n/locale';
import { consentStateOrNull } from '@/lib/ai/consent';
import { activeProvider } from '@/lib/ai/provider';
import { requireAccount } from '@/lib/auth/session';
import { countryOptions } from '@/lib/countries';
import { currencyOptions } from '@/lib/diagnostic/currencies';
import { toDraft } from '@/lib/diagnostic/draft';
import { viewFinding } from '@/lib/diagnostic/findings';
import { loadProject } from '@/lib/diagnostic/project';
import { projectPath, stepFromSlug, stepPath } from '@/lib/diagnostic/steps';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('diagnostic');
  return { title: t('pageTitle'), robots: { index: false, follow: false } };
}

/**
 * Saving an answer runs here (Server Actions run in the page's function). A typed answer may wait
 * up to 8 seconds for the AI review (D-150); this leaves room for the database around it.
 */
export const maxDuration = 30;

/** One question (or follow-up) of the diagnostic, with the project's progress beside it. */
export default async function StepPage({ params }: PageProps<'/[locale]/projects/[id]/q/[step]'>) {
  const locale = await currentLocale();
  const { id, step: slug } = await params;
  const { supabase } = await requireAccount(locale);
  const loaded = await loadProject(supabase, id);
  const step = stepFromSlug(slug);
  if (!loaded || !step) notFound();
  const { project, answers } = loaded;
  const t = await getTranslations('diagnostic');

  const core = isQuestionId(step) ? getQuestion(step) : null;
  const followUp = core ? null : FOLLOW_UPS.find((candidate) => candidate.id === step);
  // A follow-up the answers no longer call for goes back to its question.
  if (followUp && !followUp.when(answers))
    redirect(`/${locale}${stepPath(project.id, followUp.parent)}`);
  const question = core ?? followUp;
  if (!question) notFound();

  // Questions outside the quick mode stay reachable (from the overview), in full-mode order.
  const mode = diagnosticSequence(project.mode, answers).includes(step) ? project.mode : 'full';
  const previous = previousStep(mode, answers, step);
  const axis = (core ?? getQuestion(followUp?.parent ?? 'A1')).axis;
  const position = core ? positionInAxis(mode, core.id) : null;
  const score = completeness(answers);

  const saved = answers[step];
  const notes =
    core && saved
      ? [
          ...reviewAnswer(core.id, saved, answers),
          ...reviewProject(answers).filter(
            (finding) => finding.questionId === step || finding.related?.includes(core.id),
          ),
        ].filter((finding) => finding.severity === 'warn' || finding.severity === 'block')
      : [];

  const context = {
    currency: project.currency,
    country: project.countryCode,
    competitors: valueOf(answers, 'D3', 'competitors')?.items.map((item) => item.name) ?? [],
  };
  const headingId = 'question-heading';
  const helpId = 'question-help';

  // Typed answers of the core questions may go to the AI review, with a current consent (D-147).
  const typed = core?.field.kind === 'short_text' || core?.field.kind === 'long_text';
  const consent = typed && activeProvider() ? await consentStateOrNull(supabase) : null;

  return (
    <div className="mx-auto grid max-w-[75rem] gap-10 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-16 lg:py-12">
      <div className="grid content-start gap-6">
        <AxisProgress byAxis={score.byAxis} current={axis} language={locale} />
        <p className="flex flex-wrap gap-x-3 text-small text-muted">
          <span className="text-ink-2">{project.title}</span>
          <span>{AXIS_NAMES[axis][locale]}</span>
          <span>
            {position
              ? t('position', { index: position.index, total: position.total })
              : t('followUp')}
          </span>
        </p>
        <div className="grid gap-2">
          <h1 id={headingId} className="reading text-h2 font-extrabold">
            {question.label[locale]}
          </h1>
          <p id={helpId} className="reading text-ink-2">
            {question.help[locale]}
          </p>
        </div>
        {consent === 'outdated' ? (
          <p
            role="note"
            className="reading border-s-[3px] border-ink bg-sunken px-4 py-3 text-small"
          >
            {t.rich('consentOutdated', {
              account: (chunks) => <TextLink href="/account">{chunks}</TextLink>,
            })}
          </p>
        ) : null}
        <AnswerEditor
          key={step}
          locale={locale}
          projectId={project.id}
          step={step}
          field={question.field}
          reviewsText={consent === 'current'}
          headingId={headingId}
          helpId={helpId}
          allowUnknown={core?.allowUnknown ?? false}
          savedUnknown={saved?.status === 'unknown'}
          initialDraft={toDraft(
            question.field,
            saved?.status === 'answered' ? saved.value : undefined,
            context,
          )}
          initialNotes={notes.map((finding) => viewFinding(finding, locale))}
          options={{
            countries: countryOptions(locale),
            currencies: currencyOptions(locale),
            currency: project.currency,
            ...(valueOf(answers, 'C1', 'single')
              ? { payer: valueOf(answers, 'C1', 'single') }
              : {}),
          }}
          previousHref={previous ? stepPath(project.id, previous) : null}
          overviewHref={projectPath(project.id)}
        />
      </div>
      <aside>
        <CompletenessPanel
          result={score}
          language={locale}
          overviewHref={projectPath(project.id)}
        />
      </aside>
    </div>
  );
}
