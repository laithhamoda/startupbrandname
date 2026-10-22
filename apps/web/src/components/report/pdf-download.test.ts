import { buildReportModel } from '@sbn/report/model';
import { goldenReportInput } from '@sbn/report/testing/inputs';
import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { catalogues } from '@/i18n/messages';
import { PDF_ERROR_CODES } from '@/lib/report/pdf-codes';
import { PdfDownload } from './pdf-download';
import { ReportView } from './report-view';

// next-intl's navigation needs a running Next.js app; the components only need plain links.
vi.mock('@/i18n/navigation', async () => {
  const { createElement: element } = await import('react');
  return {
    Link: ({ href, children, ...props }: { href: string; children?: ReactNode }) =>
      element('a', { href, ...props }, children),
  };
});
vi.mock('@/components/ui/link-pending', () => ({ LinkPending: () => null }));

const ID = '22222222-2222-4222-8222-222222222222';

function html(locale: 'ar' | 'en', error: (typeof PDF_ERROR_CODES)[number] | null = null): string {
  return renderToStaticMarkup(
    createElement(PdfDownload, {
      projectId: ID,
      locale,
      labels: catalogues[locale].report,
      error,
    }),
  );
}

describe('the PDF download', () => {
  for (const locale of ['ar', 'en'] as const) {
    it(`is a plain form that posts to the route with the page language (${locale})`, () => {
      const markup = html(locale);
      expect(markup).toMatch(/<form [^>]*method="post"/);
      expect(markup).toContain(`action="/api/projects/${ID}/report/pdf"`);
      expect(markup).toContain(`<input type="hidden" name="locale" value="${locale}"/>`);
      expect(markup).toContain('type="submit"');
      expect(markup).toContain(catalogues[locale].report.pdf.button);
      // No client JavaScript and no alert when nothing was refused.
      expect(markup).not.toContain('<script');
      expect(markup).not.toContain('role="alert"');
    });

    it(`shows the sentence of each refusal in the page language (${locale})`, () => {
      for (const code of PDF_ERROR_CODES) {
        const markup = html(locale, code);
        expect(markup).toContain(`data-pdf-error="${code}"`);
        expect(markup).toContain('role="alert"');
        expect(markup).toContain(
          catalogues[locale].report.pdf.errors[code].replaceAll("'", '&#x27;'),
        );
      }
    });
  }

  it('has a sentence for every code the route can send, in both languages', () => {
    for (const locale of ['ar', 'en'] as const) {
      expect(Object.keys(catalogues[locale].report.pdf.errors).sort()).toEqual(
        [...PDF_ERROR_CODES].sort(),
      );
    }
  });

  it('is drawn under the title of the report, when the page gives it', () => {
    const model = buildReportModel(goldenReportInput('jo-service-subscription', { locale: 'en' }));
    const labels = catalogues.en.report;
    const hrefs = { project: '/projects/p1', pricing: '/pricing' };
    const withButton = renderToStaticMarkup(
      createElement(ReportView, {
        model,
        labels,
        hrefs,
        actions: createElement('p', { 'data-actions': true }, labels.pdf.button),
      }),
    );
    const without = renderToStaticMarkup(createElement(ReportView, { model, labels, hrefs }));
    expect(withButton).toContain('data-actions');
    expect(withButton.indexOf('data-actions')).toBeGreaterThan(withButton.indexOf('<h1'));
    expect(without).not.toContain('data-actions');
  });
});
