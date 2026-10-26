import { getTranslations } from 'next-intl/server';
import { Button } from '@/components/ui/button';
import { TextLink } from '@/components/ui/text-link';
import { projectPath } from '@/lib/diagnostic/steps';
import { chooseFinalVersion, makeReportVersion } from '@/lib/report/version-actions';
import type { VersionErrorCode } from '@/lib/report/version-actions';
import type { VersionSummary } from '@/lib/report/versions';

interface Props {
  readonly locale: 'ar' | 'en';
  readonly projectId: string;
}

const ERRORS: readonly VersionErrorCode[] = ['none_left', 'closed', 'confirm', 'failed'];

export function isVersionErrorCode(value: unknown): value is VersionErrorCode {
  return typeof value === 'string' && (ERRORS as readonly string[]).includes(value);
}

/** Western digits, isolated, in both languages (CLAUDE.md §6). */
function Num({ value }: { value: number }) {
  return <bdi className="num">{value}</bdi>;
}

/** Why the last version action did not go through. */
async function VersionError({ code }: { code: VersionErrorCode | null }) {
  if (code === null) return null;
  const t = await getTranslations('report.versions.errors');
  return (
    <p role="alert" className="reading border-s-[3px] border-ink bg-sunken px-4 py-3">
      {t(code)}
    </p>
  );
}

/**
 * The bar above a paid report (D-321): which version it is and how many are left, or that it is
 * the final one, with the form that chooses the final version while the project is open.
 */
export async function VersionBar({
  locale,
  projectId,
  number,
  left,
  final,
  versions,
  error,
}: Props & {
  number: number;
  left: number;
  final: boolean;
  versions: readonly VersionSummary[];
  error: VersionErrorCode | null;
}) {
  const t = await getTranslations('report.versions');
  return (
    <section
      aria-labelledby="versions-bar"
      className="mx-auto grid max-w-[75rem] gap-3 border-b border-hairline px-4 py-4 sm:px-6"
    >
      <h2 id="versions-bar" className="text-small font-bold text-ink">
        {final
          ? t.rich('final', { number: () => <Num value={number} /> })
          : t.rich('current', {
              number: () => <Num value={number} />,
              left: () => <Num value={left} />,
            })}
      </h2>
      <VersionError code={error} />
      {final ? (
        <p className="reading text-small text-muted">{t('closedNote')}</p>
      ) : (
        <details className="grid gap-3">
          <summary className="cursor-pointer text-small text-link underline-offset-4 hover:underline">
            {t('chooseOpen')}
          </summary>
          <ChooseForm locale={locale} projectId={projectId} versions={versions} />
        </details>
      )}
    </section>
  );
}

/**
 * Shown instead of a paid report when the answers changed since the last version: make the next
 * version while one is left, or choose the final one (D-321).
 */
export async function VersionNeeded({
  locale,
  projectId,
  next,
  left,
  versions,
  error,
}: Props & {
  next: number;
  left: number;
  versions: readonly VersionSummary[];
  error: VersionErrorCode | null;
}) {
  const t = await getTranslations('report.versions');
  return (
    <div className="mx-auto grid max-w-[40rem] gap-6 px-4 py-12 sm:px-6">
      <h1 className="text-h1 font-extrabold">
        {versions.length === 0 ? t('firstTitle') : t('changedTitle')}
      </h1>
      <VersionError code={error} />
      {left > 0 ? (
        <form action={makeReportVersion.bind(null, locale, projectId)} className="grid gap-4">
          <p className="reading">
            {t.rich('makeLead', {
              number: () => <Num value={next} />,
              left: () => <Num value={left} />,
            })}
          </p>
          <Button type="submit" variant="primary" className="justify-self-start">
            {t.rich('make', { number: () => <Num value={next} /> })}
          </Button>
        </form>
      ) : (
        <p className="reading">{t('noneLeft')}</p>
      )}
      {versions.length > 0 ? (
        <section aria-labelledby="versions-choose" className="grid gap-3">
          <h2 id="versions-choose" className="text-h3 font-bold">
            {t('chooseTitle')}
          </h2>
          <ChooseForm locale={locale} projectId={projectId} versions={versions} />
        </section>
      ) : null}
      <p className="text-small">
        <TextLink href={projectPath(projectId)}>{t('backToProject')}</TextLink>
      </p>
    </div>
  );
}

/** One version to keep as final, with a confirmation, since the choice cannot be undone. */
async function ChooseForm({
  locale,
  projectId,
  versions,
}: Props & { versions: readonly VersionSummary[] }) {
  const t = await getTranslations('report.versions');
  const verdict = await getTranslations('verdict');
  // Western digits in both languages (CLAUDE.md §6).
  const date = new Intl.DateTimeFormat(locale === 'ar' ? 'ar-u-nu-latn' : 'en', {
    dateStyle: 'medium',
  });
  return (
    <form action={chooseFinalVersion.bind(null, locale, projectId)} className="grid gap-4">
      <p className="reading text-small text-muted">{t('chooseLead')}</p>
      <fieldset className="grid gap-2">
        <legend className="sr-only">{t('chooseTitle')}</legend>
        {versions.map((version, index) => (
          <label key={version.number} className="flex items-baseline gap-3">
            <input
              type="radio"
              name="number"
              value={version.number}
              required
              defaultChecked={index === versions.length - 1}
            />
            <span>
              {t.rich('row', { number: () => <Num value={version.number} /> })}
              {' · '}
              {verdict(version.verdict)}
              {' · '}
              <span className="text-muted">{date.format(new Date(version.createdAt))}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <label className="flex items-baseline gap-3">
        <input type="checkbox" name="confirm" required />
        <span className="text-small">{t('confirm')}</span>
      </label>
      <Button type="submit" className="justify-self-start">
        {t('choose')}
      </Button>
    </form>
  );
}
