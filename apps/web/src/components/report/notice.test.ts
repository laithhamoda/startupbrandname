import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { catalogues } from '@/i18n/messages';
import { stepPath } from '@/lib/diagnostic/steps';
import { noticeReasonsOf, ReportNotice } from './notice';

// next-intl's navigation needs a running Next.js app; the notice only needs plain links.
vi.mock('@/i18n/navigation', async () => {
  const { createElement: element } = await import('react');
  return {
    Link: ({ href, children, ...props }: { href: string; children?: ReactNode }) =>
      element('a', { href, ...props }, children),
  };
});
vi.mock('@/components/ui/link-pending', () => ({ LinkPending: () => null }));

const REASONS = [
  { code: 'unknown_answer', questionId: 'F3' },
  { code: 'unknown_answer', questionId: 'F3' },
  { code: 'currency_mismatch', questionId: 'F1', currency: 'USD' },
  { code: 'invalid_project', questionId: null, item: 'currency' },
] as const;

describe('noticeReasonsOf (D-286)', () => {
  it('says each reason once, in words, and links it to the question to answer', () => {
    const said = noticeReasonsOf(REASONS, 'p1', 'en', (code) => `says ${code}`);
    expect(said.map(({ text, link }) => ({ text, link }))).toEqual([
      {
        text: 'says unknown_answer',
        link: { label: 'Variable cost per unit', href: stepPath('p1', 'F3') },
      },
      {
        text: 'says currency_mismatch',
        link: { label: 'Selling price per unit or service', href: stepPath('p1', 'F1') },
      },
      { text: 'says invalid_project', link: null },
    ]);
    // A list key of a reason is its code and its question, so a repeated reason has one entry.
    expect(new Set(said.map((reason) => reason.key)).size).toBe(3);
  });

  it('names the question in the language of the page', () => {
    const [first] = noticeReasonsOf(REASONS, 'p1', 'ar', () => '');
    expect(first?.link?.label).toBe('التكلفة المتغيرة لكل وحدة');
  });
});

// `cn` only joins class names, so the placing of the notice is its caller's: the report page centres
// it above its column (`mx-auto`), the project page leaves it at the start of its own (D-286).
describe('ReportNotice placing', () => {
  const labels = catalogues.en.report;
  const reasons = [{ key: 'one', text: 'Not answered yet:', link: null }];
  const html = (failed: boolean, className?: string) =>
    renderToStaticMarkup(createElement(ReportNotice, { failed, reasons, labels, className }));

  it('is centred only when its caller says so, for the list of reasons', () => {
    expect(html(false, 'mx-auto')).toContain('mx-auto');
    expect(html(false)).not.toContain('mx-auto');
  });

  it('is centred only when its caller says so, for the failure', () => {
    expect(html(true, 'mx-auto')).toContain('mx-auto');
    expect(html(true)).not.toContain('mx-auto');
  });
});
