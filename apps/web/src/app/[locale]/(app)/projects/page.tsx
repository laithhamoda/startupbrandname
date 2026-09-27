import { completeness, displayPercent } from '@sbn/question-bank';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { ButtonLink } from '@/components/ui/button';
import { PLANS } from '@/config/plans';
import { Link } from '@/i18n/navigation';
import { currentLocale } from '@/i18n/locale';
import { requireAccount } from '@/lib/auth/session';
import { countryOptions } from '@/lib/countries';
import { listProjects } from '@/lib/diagnostic/project';
import { projectPath } from '@/lib/diagnostic/steps';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('projects');
  return { title: t('title'), robots: { index: false, follow: false } };
}

/** Everyone is on the free plan until payments exist (D-109). */
const PROJECT_LIMIT =
  PLANS.free.entitlements.projects.kind === 'count'
    ? PLANS.free.entitlements.projects.value
    : Infinity;

/** The signed-in home: the account's projects as rows, not cards (M1 design plan). */
export default async function ProjectsPage() {
  const locale = await currentLocale();
  const { supabase } = await requireAccount(locale);
  const t = await getTranslations('projects');
  const projects = await listProjects(supabase);
  const countries = countryOptions(locale);
  // Western digits in both languages (CLAUDE.md §6).
  const date = new Intl.DateTimeFormat(locale === 'ar' ? 'ar-u-nu-latn' : 'en', {
    dateStyle: 'medium',
  });
  const canCreate = projects.length < PROJECT_LIMIT;

  return (
    <div className="mx-auto grid max-w-[75rem] gap-8 px-4 py-10 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid gap-2">
          <h1 className="text-h1 font-extrabold">{t('title')}</h1>
          <p className="text-small text-muted">
            {t('plan', { count: projects.length, limit: PROJECT_LIMIT })}
          </p>
        </div>
        {canCreate ? (
          <ButtonLink href="/projects/new" variant="primary">
            {t('new')}
          </ButtonLink>
        ) : null}
      </header>

      {projects.length === 0 ? (
        <p className="reading text-body-lg text-ink-2">{t('empty')}</p>
      ) : (
        <ul className="grid border-t border-hairline">
          {projects.map(({ project, answers }) => (
            <li
              key={project.id}
              className="grid gap-1 border-b border-hairline py-4 md:grid-cols-[minmax(0,2fr)_1fr_1fr_1fr] md:items-baseline md:gap-6"
            >
              <Link
                href={projectPath(project.id)}
                className="font-display text-body font-bold text-ink underline-offset-4 hover:underline"
              >
                {project.title}
              </Link>
              <span className="text-small text-ink-2">
                {countries.find((option) => option.value === project.countryCode)?.label}
              </span>
              <span className="text-small text-ink-2">
                {t('completeness')}{' '}
                <bdi className="num">{displayPercent(completeness(answers).score)}%</bdi>
              </span>
              <span className="text-small text-muted">
                {t('updated')} {date.format(new Date(project.updatedAt))}
              </span>
            </li>
          ))}
        </ul>
      )}

      {canCreate ? null : <p className="reading text-small text-muted">{t('limit')}</p>}
    </div>
  );
}
