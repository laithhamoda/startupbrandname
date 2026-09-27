import {
  AXES,
  AXIS_NAMES,
  completeness,
  firstUnanswered,
  getQuestion,
  reviewProject,
  validationTasks,
} from '@sbn/question-bank';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { FindingList } from '@/components/diagnostic/finding-list';
import { ProjectSettings } from '@/components/diagnostic/project-settings';
import { CompletenessPanel } from '@/components/diagnostic/progress';
import { ButtonLink } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { TextLink } from '@/components/ui/text-link';
import { currentLocale } from '@/i18n/locale';
import { requireAccount } from '@/lib/auth/session';
import { countryOptions } from '@/lib/countries';
import { deleteProject, switchMode } from '@/lib/diagnostic/actions';
import { viewFinding } from '@/lib/diagnostic/findings';
import { loadProject } from '@/lib/diagnostic/project';
import { stepPath } from '@/lib/diagnostic/steps';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/projects/[id]'>): Promise<Metadata> {
  const locale = await currentLocale();
  const { supabase } = await requireAccount(locale);
  const loaded = await loadProject(supabase, (await params).id);
  return { title: loaded?.project.title ?? '', robots: { index: false, follow: false } };
}

/** Where the project stands: completeness, what is missing, notes to resolve, tasks to test. */
export default async function ProjectPage({ params }: PageProps<'/[locale]/projects/[id]'>) {
  const locale = await currentLocale();
  const { supabase } = await requireAccount(locale);
  const loaded = await loadProject(supabase, (await params).id);
  if (!loaded) notFound();
  const { project, answers } = loaded;
  const t = await getTranslations('diagnostic.overview');

  const score = completeness(answers);
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
          <h1 className="text-h1 font-extrabold">{project.title}</h1>
          <p className="flex flex-wrap gap-x-4 text-small text-muted">
            <span>{country}</span>
            <span>{project.currency}</span>
            <span>{t(project.mode === 'quick' ? 'modeQuick' : 'modeFull')}</span>
          </p>
          <div className="pt-2">
            {resume ? (
              <ButtonLink href={stepPath(project.id, resume)} variant="primary">
                {Object.keys(answers).length === 0 ? t('start') : t('resume')}
              </ButtonLink>
            ) : (
              <p className="text-body-lg">
                {project.mode === 'quick' ? t('quickDone') : t('allDone')}
              </p>
            )}
          </div>
        </header>

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
                    {getQuestion(task.questionId).label[locale]}
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
            project.mode === 'quick' ? 'full' : 'quick',
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
