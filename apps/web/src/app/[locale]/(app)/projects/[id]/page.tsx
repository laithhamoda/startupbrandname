import {
  AXES,
  AXIS_NAMES,
  completeness,
  firstUnanswered,
  getQuestion,
  reviewProject,
  stepLabel,
  validationTasks,
} from '@sbn/question-bank';
import type { Metadata } from 'next';
import { getMessages, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { FindingList } from '@/components/diagnostic/finding-list';
import { ProjectSettings } from '@/components/diagnostic/project-settings';
import { ProjectResult, type ProjectResultView } from '@/components/diagnostic/project-result';
import { CompletenessPanel } from '@/components/diagnostic/progress';
import { noticeReasonsOf } from '@/components/report/notice';
import { ButtonLink } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { TextLink } from '@/components/ui/text-link';
import { currentLocale } from '@/i18n/locale';
import { requireAccount } from '@/lib/auth/session';
import { countryOptions } from '@/lib/countries';
import { deleteProject, switchMode } from '@/lib/diagnostic/actions';
import { viewFinding } from '@/lib/diagnostic/findings';
import { loadProject } from '@/lib/diagnostic/project';
import { canvasPath, reportPath, stepPath } from '@/lib/diagnostic/steps';
import { reportAccess } from '@/lib/entitlements';
import { accountAccess } from '@/lib/report/account-access';
import { loadProjectResult } from '@/lib/report/result';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/projects/[id]'>): Promise<Metadata> {
  const locale = await currentLocale();
  const { supabase } = await requireAccount(locale);
  const loaded = await loadProject(supabase, (await params).id);
  return { title: loaded?.project.title ?? '', robots: { index: false, follow: false } };
}

/**
 * Where the project stands: the check result, completeness, what is missing, notes to resolve,
 * tasks to test.
 */
export default async function ProjectPage({ params }: PageProps<'/[locale]/projects/[id]'>) {
  const locale = await currentLocale();
  const { supabase, user } = await requireAccount(locale);
  const loaded = await loadProject(supabase, (await params).id);
  if (!loaded) notFound();
  const { project, answers } = loaded;
  const t = await getTranslations('diagnostic.overview');

  const score = completeness(answers);
  // What the report page will show this account: the entry names it (D-277). The page decides again.
  const reportEntry = reportAccess(score.gate, (await accountAccess(supabase, user.email)).access);

  // The check result, drawn on this page so the founder meets it where the diagnostic ends (D-286).
  const money = await getTranslations('money');
  const reasonText = await getTranslations('canvas');
  const symbols: Record<string, string> = {
    JOD: money('symbol.JOD'),
    DZD: money('symbol.DZD'),
    USD: money('symbol.USD'),
  };
  const result = await loadProjectResult(supabase, project.id, {
    email: user.email,
    locale,
    gate: score.gate,
    currencyLabel: (code) => symbols[code] ?? code,
  });
  const resultView: ProjectResultView =
    result.status === 'needs_answers'
      ? {
          status: 'needs_answers',
          reasons: noticeReasonsOf(result.reasons, project.id, locale, (code) =>
            reasonText(`notice.reason.${code}`),
          ),
        }
      : result;
  const reportLabels = (await getMessages()).report;
  const resume = firstUnanswered(project.mode, answers);
  const notes = reviewProject(answers).map((finding) => viewFinding(finding, locale));
  const tasks = validationTasks(answers);
  const country = countryOptions(locale).find(
    (option) => option.value === project.countryCode,
  )?.label;

  return (
    <div className="mx-auto grid max-w-[75rem] gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-16">
      <div className="grid content-start gap-10">
        <header className="grid gap-3">
          <p className="text-small text-muted">
            <TextLink href="/projects">{t('back')}</TextLink>
          </p>
          <h1 className="text-h1 font-extrabold">
            {/* Typed by the founder, in any script: its own direction (UX-12). */}
            <span dir="auto">{project.title}</span>
          </h1>
          <p className="flex flex-wrap gap-x-4 text-small text-muted">
            <span>{country}</span>
            <span>{project.currency}</span>
            <span>{t(project.mode === 'quick' ? 'modeQuick' : 'modeFull')}</span>
          </p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-3 pt-2">
            {resume ? (
              <ButtonLink href={stepPath(project.id, resume)} variant="primary">
                {Object.keys(answers).length === 0 ? t('start') : t('resume')}
              </ButtonLink>
            ) : (
              <p className="text-body-lg">
                {project.mode === 'quick' ? t('quickDone') : t('allDone')}
              </p>
            )}
            <ButtonLink href={canvasPath(project.id)}>{t('canvas')}</ButtonLink>
            <ButtonLink href={reportPath(project.id)} variant={resume ? 'secondary' : 'primary'}>
              {reportEntry === 'full' ? t('report') : t('result.open')}
            </ButtonLink>
          </div>
        </header>

        <ProjectResult
          view={resultView}
          heading={t('result.heading')}
          locale={locale}
          labels={reportLabels}
        />

        <section
          aria-labelledby="axes-heading"
          className="grid gap-4 border-t border-hairline pt-8"
        >
          <h2 id="axes-heading" className="text-h3 font-bold">
            {t('axes')}
          </h2>
          <ul className="grid gap-4 sm:grid-cols-2">
            {AXES.map((axis) => (
              <li key={axis}>
                <Progress value={score.byAxis[axis] * 100} label={AXIS_NAMES[axis][locale]} />
              </li>
            ))}
          </ul>
        </section>

        {score.next.length > 0 ? (
          <section
            aria-labelledby="next-heading"
            className="grid gap-4 border-t border-hairline pt-8"
          >
            <h2 id="next-heading" className="text-h3 font-bold">
              {t('next')}
            </h2>
            <p className="reading text-small text-muted">{t('nextLead')}</p>
            <ol className="grid gap-2">
              {score.next.slice(0, 5).map((id) => (
                <li key={id}>
                  <TextLink href={stepPath(project.id, id)}>
                    {getQuestion(id).label[locale]}
                  </TextLink>
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        {notes.length > 0 ? (
          <section
            aria-labelledby="notes-heading"
            className="grid gap-4 border-t border-hairline pt-8"
          >
            <h2 id="notes-heading" className="text-h3 font-bold">
              {t('notes')}
            </h2>
            <FindingList findings={notes} relatedHref={(id) => stepPath(project.id, id)} />
          </section>
        ) : null}

        {tasks.length > 0 ? (
          <section
            aria-labelledby="tasks-heading"
            className="grid gap-4 border-t border-hairline pt-8"
          >
            <h2 id="tasks-heading" className="text-h3 font-bold">
              {t('tasks')}
            </h2>
            <p className="reading text-small text-muted">{t('tasksLead')}</p>
            <ul className="grid gap-2">
              {tasks.map((task) => (
                <li key={`${task.kind}-${task.questionId}`} className="grid gap-0.5">
                  <span className="text-caption text-muted">{t(`task.${task.kind}`)}</span>
                  <TextLink href={stepPath(project.id, task.questionId)}>
                    {stepLabel(task.questionId)[locale]}
                  </TextLink>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <ProjectSettings
          mode={project.mode}
          switchMode={switchMode.bind(
            null,
            locale,
            project.id,
            project.mode === 'full' ? 'quick' : 'full',
          )}
          deleteProject={deleteProject.bind(null, locale, project.id)}
        />
      </div>
      <aside>
        <CompletenessPanel result={score} language={locale} />
      </aside>
    </div>
  );
}
