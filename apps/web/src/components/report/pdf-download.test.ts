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

function html(
  locale: 'ar' | 'en',
  error: (typeof PDF_ERROR_CODES)[number] | null = null,
  rated = true,
  defaultEmail: string | null = null,
  full = false,
): string {
  return renderToStaticMarkup(
    createElement(PdfDownload, {
      projectId: ID,
      locale,
      labels: catalogues[locale].report,
      error,
      rated,
      defaultEmail,
      full,
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
  }, 30_000);

  for (const locale of ['ar', 'en'] as const) {
    it(`asks for the rating on a version not rated yet, in the same plain form (${locale}, D-345)`, () => {
      const markup = html(locale, null, false);
      const radios = markup.match(/<input[^>]*name="stars"[^>]*>/g) ?? [];
      expect(radios).toHaveLength(5);
      for (const radio of radios) {
        expect(radio).toContain('type="radio"');
        expect(radio).toContain('required');
      }
      expect(markup).toContain('<fieldset');
      expect(markup).toContain('<textarea name="comment"');
      expect(markup).toContain('maxLength="1000"');
      expect(markup).toContain(catalogues[locale].report.pdf.rating.legend);
      expect(markup).not.toContain('<script');
    });

    it(`asks nothing on a version already rated (${locale})`, () => {
      const markup = html(locale, null, true);
      expect(markup).not.toContain('name="stars"');
      expect(markup).not.toContain('<textarea');
    });
  }

  for (const locale of ['ar', 'en'] as const) {
    it(`asks for the name and the phone on the full report only (${locale}, D-348)`, () => {
      const full = html(locale, null, true, null, true);
      const tag = (markup: string, name: string) =>
        new RegExp(`<input[^>]*name="${name}"[^>]*>`).exec(markup)?.[0] ?? '';
      expect(tag(full, 'contact_name')).toContain('required');
      expect(tag(full, 'contact_phone')).toContain('required');
      expect(tag(full, 'contact_email')).not.toContain('required');
      expect(full).toContain(catalogues[locale].report.pdf.contact.hintRequired);
      const summary = html(locale);
      expect(tag(summary, 'contact_name')).not.toContain('required');
      expect(tag(summary, 'contact_phone')).not.toContain('required');
    });

    it(`offers the contact fields on every form, the email filled in from the account (${locale}, D-346)`, () => {
      for (const rated of [true, false]) {
        const markup = html(locale, null, rated, 'founder@example.test');
        expect(markup).toContain('name="contact_name"');
        expect(markup).toContain('autoComplete="name"');
        expect(markup).toMatch(/<input[^>]*name="contact_email"[^>]*value="founder@example.test"/);
        expect(markup).toContain('name="contact_phone"');
        expect(markup).toContain(catalogues[locale].report.pdf.contact.legend);
        // None of them is required: the cover prints what is given.
        expect(markup.match(/<input[^>]*name="contact_[a-z]+"[^>]*>/g)?.join('')).not.toContain(
          'required',
        );
      }
    });

    it(`has no email value without an account email (${locale})`, () => {
      expect(html(locale, null, true, null)).not.toContain('value="founder');
    });
  }
});
