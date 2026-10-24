import { buildReportModel, messagesFor, type Section } from '@sbn/report/model';
import { goldenReportInput } from '@sbn/report/testing/inputs';
import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { noticeReasonsOf } from '@/components/report/notice';
import { catalogues } from '@/i18n/messages';
import { stepPath } from '@/lib/diagnostic/steps';
import { ProjectResult, type ProjectResultView } from './project-result';

// next-intl's navigation needs a running Next.js app; the region only needs plain links.
vi.mock('@/i18n/navigation', async () => {
  const { createElement: element } = await import('react');
  return {
    Link: ({ href, children, ...props }: { href: string; children?: ReactNode }) =>
      element('a', { href, ...props }, children),
  };
});
vi.mock('@/components/ui/link-pending', () => ({ LinkPending: () => null }));

const escapeHtml = (text: string) =>
  text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#x27;');

/** The verdict section of the summary of a golden project: what the project page draws. */
function verdictSection(
  project: Parameters<typeof goldenReportInput>[0],
  locale: 'ar' | 'en',
): Section {
  const model = buildReportModel(
    goldenReportInput(project, { locale, kind: 'summary', lockReason: 'completeness' }),
  );
  const section = model.sections.find((candidate) => candidate.id === 'verdict');
  if (!section) throw new Error('the summary has no verdict section');
  return section;
}

function htmlOf(view: ProjectResultView, locale: 'ar' | 'en' = 'en'): string {
  return renderToStaticMarkup(
    createElement(ProjectResult, {
      view,
      heading: locale === 'ar' ? 'نتيجة الفحص' : 'Check result',
      locale,
      labels: catalogues[locale].report,
    }),
  );
}

describe('ProjectResult (D-286)', () => {
  it('draws the verdict slab under its heading, still: no reveal motion (D-287)', () => {
    const html = htmlOf({
      status: 'verdict',
      section: verdictSection('jo-service-subscription', 'en'),
    });
    expect(html).toMatch(
      /<section aria-labelledby="([^"]+)"[^>]*><h2 id="\1"[^>]*>Check result<\/h2>/,
    );
    expect(html).toContain('data-verdict="revise"');
    expect(html).toContain(escapeHtml(messagesFor('en').verdictWords.revise));
    expect(html).not.toContain('data-report-reveal');
  });

  it('says a go in its own word, with no changes to make', () => {
    const html = htmlOf({
      status: 'verdict',
      section: verdictSection('dz-auto-entrepreneur', 'en'),
    });
    expect(html).toContain('data-verdict="go"');
    expect(html).not.toContain(escapeHtml(messagesFor('en').executive.changesCaption.stop));
  });

  it('gives a stop its fixed sentence and its three changes, never a bare stop', () => {
    const section = verdictSection('jo-home-ecommerce', 'en');
    const html = htmlOf({ status: 'verdict', section });
    expect(html).toContain('data-verdict="stop"');
    expect(html).toContain(escapeHtml(messagesFor('en').stopSentence));
    expect(html).toContain(escapeHtml(messagesFor('en').executive.changesCaption.stop));
    const table = section.blocks.find((block) => block.type === 'table');
    expect(table?.type === 'table' ? table.rows : []).toHaveLength(3);
  });

  it('says the same in Arabic, from the model’s own words', () => {
    const section = verdictSection('jo-service-subscription', 'ar');
    const html = htmlOf({ status: 'verdict', section }, 'ar');
    expect(html).toContain('نتيجة الفحص');
    expect(html).toContain(escapeHtml(messagesFor('ar').verdictWords.revise));
    expect(html).not.toContain('data-report-reveal');
  });

  it('lists what to answer or correct, each with a link to its question', () => {
    const reasons = noticeReasonsOf(
      [
        { code: 'unknown_answer', questionId: 'F3' },
        { code: 'currency_mismatch', questionId: 'F1', currency: 'USD' },
      ],
      'p1',
      'en',
      (code) => `reason ${code}:`,
    );
    const html = htmlOf({ status: 'needs_answers', reasons });
    const labels = catalogues.en.report;
    expect(html).toContain(escapeHtml(labels.notice.title));
    expect(html).toContain('reason unknown_answer:');
    expect(html).toContain('reason currency_mismatch:');
    expect(html).toContain(`href="${stepPath('p1', 'F3')}"`);
    expect(html).toContain(`href="${stepPath('p1', 'F1')}"`);
    expect(html).not.toContain('data-verdict');
  });

  it('does not leave the region empty when no reason came with the numbers', () => {
    const html = htmlOf({ status: 'needs_answers', reasons: [] });
    expect(html).toContain(escapeHtml(catalogues.en.report.notice.failed));
  });

  it('tells a founder below the summary gate that the result needs more answers', () => {
    const labels = catalogues.en.report;
    const html = htmlOf({ status: 'none' });
    expect(html).toContain(escapeHtml(labels.none.title));
    expect(html).toContain(escapeHtml(labels.none.lead));
    expect(html).not.toContain('data-verdict');
  });

  it('says in one sentence that the numbers could not be calculated now', () => {
    const html = htmlOf({ status: 'failed' });
    expect(html).toContain(escapeHtml(catalogues.en.report.notice.failed));
    expect(html).not.toContain('data-verdict');
  });
});
