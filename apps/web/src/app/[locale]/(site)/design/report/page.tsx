import { buildReportModel, type ReportInput } from '@sbn/report/model';
import { drop, goldenReportInput } from '@sbn/report/testing/inputs';
import type { Metadata } from 'next';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { ReportView } from '@/components/report/report-view';
import { TextLink } from '@/components/ui/text-link';
import { getServerEnv } from '@/env/server';
import { currentLocale } from '@/i18n/locale';

const TITLE = { ar: 'معرض التقرير', en: 'Report gallery' } as const;
const LEAD = {
  ar: 'التقرير على الشاشة مبنيّ من المشاريع النموذجية الثلاثة بلا قاعدة بيانات: مشروع أردني للخدمات (عدّل)، ومشروع جزائري (امضِ)، ومتجر منزلي أردني (توقّف). للمراجعة البصرية فقط.',
  en: 'The report on screen, built from the three golden projects with no database: a Jordanian service project (Revise), an Algerian project (Go) and a Jordanian home shop (Stop). For visual review only.',
} as const;

const PROJECTS = {
  'jo-service-subscription': { ar: 'خدمة أردنية (عدّل)', en: 'Jordanian service (Revise)' },
  'dz-auto-entrepreneur': { ar: 'مشروع جزائري (امضِ)', en: 'Algerian project (Go)' },
  'jo-home-ecommerce': { ar: 'متجر أردني (توقّف)', en: 'Jordanian shop (Stop)' },
} as const;
const VIEWS = {
  full: { ar: 'التقرير الكامل', en: 'Full report' },
  plan: { ar: 'ملخص مقفل بالخطة', en: 'Summary locked by the plan' },
  nocalc: { ar: 'ملخص بلا حساب', en: 'Summary with no calculation' },
} as const;

const LISTS = {
  ar: { project: 'المشروع', view: 'العرض' },
  en: { project: 'Project', view: 'View' },
} as const;

type ProjectName = keyof typeof PROJECTS;
type ViewName = keyof typeof VIEWS;

const isProject = (value: unknown): value is ProjectName =>
  typeof value === 'string' && Object.hasOwn(PROJECTS, value);
const isView = (value: unknown): value is ViewName =>
  typeof value === 'string' && Object.hasOwn(VIEWS, value);

export async function generateMetadata(): Promise<Metadata> {
  return { title: TITLE[await currentLocale()], robots: { index: false, follow: false } };
}

/** The input of one gallery view: the fixtures of the golden projects, the day fixed (D-276). */
function inputOf(project: ProjectName, view: ViewName, locale: 'ar' | 'en'): ReportInput {
  if (view === 'plan') {
    return goldenReportInput(project, { locale, kind: 'summary', lockReason: 'plan' });
  }
  if (view === 'nocalc') {
    return goldenReportInput(project, {
      locale,
      kind: 'summary',
      lockReason: 'completeness',
      withoutRun: [{ code: 'missing_answer', questionId: 'F3' }],
      change: (answers) => {
        drop(answers, 'F3', 'F4', 'F5', 'F6', 'D4', 'E8');
      },
    });
  }
  return goldenReportInput(project, { locale, kind: 'full' });
}

// Internal page, like /design: never on the production deployment (D-058). It builds models from
// fixtures with no database, so the report can be reviewed in both languages and every verdict.
export default async function ReportGalleryPage({
  searchParams,
}: PageProps<'/[locale]/design/report'>) {
  if (getServerEnv().VERCEL_ENV === 'production') notFound();
  const locale = await currentLocale();
  const query = await searchParams;
  const rawProject = Array.isArray(query.project) ? query.project[0] : query.project;
  const rawView = Array.isArray(query.view) ? query.view[0] : query.view;
  const project: ProjectName = isProject(rawProject) ? rawProject : 'jo-service-subscription';
  const view: ViewName = isView(rawView) ? rawView : 'full';

  const input = inputOf(project, view, locale);
  const model = buildReportModel(input);

  return (
    <>
      <div className="mx-auto grid max-w-[75rem] gap-4 px-4 pt-10 sm:px-6">
        <p className="font-display text-h3 font-bold">{TITLE[locale]}</p>
        <p className="reading text-muted">{LEAD[locale]}</p>
        <ul
          aria-label={LISTS[locale].project}
          className="flex flex-wrap gap-x-5 gap-y-2 text-small"
        >
          {(Object.keys(PROJECTS) as ProjectName[]).map((name) => (
            <li key={name}>
              <TextLink href={`/design/report?project=${name}&view=${view}`}>
                {PROJECTS[name][locale]}
              </TextLink>
            </li>
          ))}
        </ul>
        <ul aria-label={LISTS[locale].view} className="flex flex-wrap gap-x-5 gap-y-2 text-small">
          {(Object.keys(VIEWS) as ViewName[]).map((name) => (
            <li key={name}>
              <TextLink href={`/design/report?project=${project}&view=${name}`}>
                {VIEWS[name][locale]}
              </TextLink>
            </li>
          ))}
        </ul>
      </div>
      <ReportView
        model={model}
        labels={(await getMessages()).report}
        hrefs={{ project: '/design', pricing: '/pricing' }}
      />
    </>
  );
}
