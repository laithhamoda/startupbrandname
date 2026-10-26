import { stepLabel } from '@sbn/question-bank';
import type { Metadata } from 'next';
import { getMessages, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { NotEnoughAnswers } from '@/components/report/not-enough';
import { PdfDownload } from '@/components/report/pdf-download';
import { noticeReasonsOf, ReportNotice } from '@/components/report/notice';
import { ReportView } from '@/components/report/report-view';
import { isVersionErrorCode, VersionBar, VersionNeeded } from '@/components/report/versions';
import { currentLocale } from '@/i18n/locale';
import { requireAccount } from '@/lib/auth/session';
import { projectPath, stepPath } from '@/lib/diagnostic/steps';
import { loadReportPage } from '@/lib/report/load';
import { isPdfErrorCode, pdfDownloadAvailable } from '@/lib/report/pdf-codes';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('report');
  // Never the project's title: the founder typed it, and it travels into browser history.
  return {
    title: t('pageTitle'),
    robots: { index: false, follow: false },
  };
}

/**
 * The project's report (M5 step 5b, D-273): the one-page summary or the full report, drawn from the
 * `ReportModel` the server builds. The access is decided here from the completeness gate and the
 * account's entitlement, and the model holds nothing for a locked section (D-232), so no value a
 * locked section would show reaches the page or the browser. The page makes no client call.
 */
export default async function ReportPage({
  params,
  searchParams,
}: PageProps<'/[locale]/projects/[id]/report'>) {
  const locale = await currentLocale();
  const { supabase, user } = await requireAccount(locale);
  const money = await getTranslations('money');
  const reasonText = await getTranslations('canvas');
  const { id } = await params;
  const query = await searchParams;
  const refused = query.pdf;
  const versionError = isVersionErrorCode(query.version) ? query.version : null;

  const symbols: Record<string, string> = {
    JOD: money('symbol.JOD'),
    DZD: money('symbol.DZD'),
    USD: money('symbol.USD'),
  };
  const page = await loadReportPage(supabase, id, {
    email: user.email,
    locale,
    currencyLabel: (code) => symbols[code] ?? code,
  });
  if (!page) notFound();

  const labels = (await getMessages()).report;
  const backHref = projectPath(id);

  if (page.status === 'none') {
    return (
      <NotEnoughAnswers
        percent={page.percent}
        backHref={backHref}
        labels={labels}
        missing={page.missing.map((step) => ({
          id: step,
          label: stepLabel(step)[locale],
          href: stepPath(id, step),
        }))}
      />
    );
  }
  if (page.status === 'version_needed') {
    return (
      <VersionNeeded
        locale={locale}
        projectId={id}
        next={page.next}
        remaining={page.remaining}
        versions={page.versions}
        error={versionError}
      />
    );
  }
  if (page.status === 'failed') {
    return (
      <div className="mx-auto grid max-w-[75rem] gap-6 px-4 py-10 sm:px-6">
        <h1 className="text-h1 font-extrabold">{labels.pageTitle}</h1>
        <ReportNotice failed reasons={[]} labels={labels} className="mx-auto" />
      </div>
    );
  }

  const notice = page.notice;
  const reasons =
    notice?.kind === 'not_calculable'
      ? noticeReasonsOf(notice.reasons, id, locale, (code) => reasonText(`notice.reason.${code}`))
      : [];

  return (
    <>
      {page.version ? (
        <VersionBar
          locale={locale}
          projectId={id}
          number={page.version.number}
          remaining={page.version.remaining}
          final={page.version.final}
          versions={page.version.versions}
          error={versionError}
        />
      ) : null}
      {notice ? (
        <div className="px-4 pt-10 sm:px-6">
          <ReportNotice
            failed={notice.kind === 'failed'}
            reasons={reasons}
            labels={labels}
            className="mx-auto"
          />
        </div>
      ) : null}
      <ReportView
        model={page.model}
        labels={labels}
        hrefs={{ project: backHref, pricing: '/pricing' }}
        actions={
          pdfDownloadAvailable(page) ? (
            <PdfDownload
              projectId={id}
              locale={locale}
              labels={labels}
              error={isPdfErrorCode(refused) ? refused : null}
            />
          ) : null
        }
      />
    </>
  );
}
