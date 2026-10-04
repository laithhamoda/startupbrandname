import {
  AXIS_NAMES,
  completeness,
  positionInAxis,
  positionInMode,
  previousStep,
  resolveStep,
  sequenceModeFor,
  stepNotes,
  valueOf,
} from '@sbn/question-bank';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { notFound, redirect } from 'next/navigation';
import { cache, type ReactNode } from 'react';
import { AnswerEditor } from '@/components/diagnostic/answer-editor';
import { AxisProgress, CompletenessPanel } from '@/components/diagnostic/progress';
import { QuestionHeading } from '@/components/diagnostic/question-heading';
import { TextLink } from '@/components/ui/text-link';
import { currentLocale } from '@/i18n/locale';
import type { Locale } from '@/i18n/routing';
import { consentStateOrNull } from '@/lib/ai/consent';
import { activeProvider } from '@/lib/ai/provider';
import { requireAccount } from '@/lib/auth/session';
import { countryOptions } from '@/lib/countries';
import { currencyOptions } from '@/lib/diagnostic/currencies';
import { toDraft } from '@/lib/diagnostic/draft';
import { viewFinding } from '@/lib/diagnostic/findings';
import { loadProject } from '@/lib/diagnostic/project';
import { projectPath, stepFromSlug, stepPath } from '@/lib/diagnostic/steps';

/** The project and its answers, read once per request for the page and its title. */
const loadStep = cache(async (locale: Locale, id: string) => {
  const { supabase } = await requireAccount(locale);
  return loadProject(supabase, id);
});

/**
 * A title per step (position, axis, "Diagnostic"), so that moving on is announced (UX-5). Never
 * the project's title: the founder typed it, and the title travels into browser history.
 */
export async function generateMetadata({
  params,
}: PageProps<'/[locale]/projects/[id]/q/[step]'>): Promise<Metadata> {
  const locale = await currentLocale();
  const t = await getTranslations('diagnostic');
  const robots = { index: false, follow: false };
  const { id, step: slug } = await params;
  const step = stepFromSlug(slug);
  const loaded = step ? await loadStep(locale, id) : null;
  const resolved = step && loaded ? resolveStep(step, loaded.answers) : null;
  if (!step || !loaded || resolved?.status !== 'active') return { title: t('pageTitle'), robots };

  const axis = AXIS_NAMES[resolved.step.axis][locale];
  const core = resolved.step.question;
  if (!core) return { title: t('followUpTitle', { axis }), robots };
  const mode = sequenceModeFor(loaded.project.mode, loaded.answers, step);
  const { index, total } = positionInMode(mode, core.id);
  return { title: t('stepTitle', { index: String(index), total: String(total), axis }), robots };
}

/** Western digits, isolated from the text around them (CLAUDE.md §6). */
const num = (chunks: ReactNode) => <bdi className="num">{chunks}</bdi>;

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
  const loaded = await loadStep(locale, id);
  const step = stepFromSlug(slug);
  if (!loaded || !step) notFound();
  const { project, answers } = loaded;
  const t = await getTranslations('diagnostic');

  const resolved = resolveStep(step, answers);
  if (!resolved) notFound();
  // A follow-up the answers no longer call for goes back to its question.
  if (resolved.status === 'inactive') {
    redirect(`/${locale}${stepPath(project.id, resolved.parent)}`);
  }
  const question = resolved.step;
  const core = question.question;

  // Questions outside the quick mode stay reachable (from the overview), in full-mode order.
  const mode = sequenceModeFor(project.mode, answers, step);
  const previous = previousStep(mode, answers, step);
  const axis = question.axis;
  const position = core ? positionInAxis(mode, core.id) : null;
  const overall = core ? positionInMode(mode, core.id) : null;
  const score = completeness(answers);

  const saved = answers[step];
  // The same warnings saveAnswer showed after the save, follow-ups included (ARCH-6).
  const notes = stepNotes(step, answers);

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
        <div className="grid gap-1 text-small text-muted">
          <p className="flex flex-wrap gap-x-3">
            <span className="text-ink-2">{project.title}</span>
            <span>{AXIS_NAMES[axis][locale]}</span>
            <span>
              {position
                ? t.rich('position', { index: position.index, total: position.total, num })
                : t('followUp')}
            </span>
          </p>
          {overall ? (
            <p>
              {t.rich(mode === 'quick' ? 'overallQuick' : 'overallFull', {
                index: overall.index,
                total: overall.total,
                num,
              })}
            </p>
          ) : null}
        </div>
        <div className="grid gap-2">
          <QuestionHeading key={step} id={headingId}>
            {question.label[locale]}
          </QuestionHeading>
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
          allowUnknown={question.allowUnknown}
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
