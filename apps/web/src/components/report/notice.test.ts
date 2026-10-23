import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { stepPath } from '@/lib/diagnostic/steps';
import { noticeReasonsOf } from './notice';

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
    expect(noticeReasonsOf(REASONS, 'p1', 'en', (code) => `says ${code}`)).toEqual([
      {
        key: 'unknown_answer-F3',
        text: 'says unknown_answer',
        link: { label: 'Variable cost per unit', href: stepPath('p1', 'F3') },
      },
      {
        key: 'currency_mismatch-F1',
        text: 'says currency_mismatch',
        link: { label: 'Selling price per unit or service', href: stepPath('p1', 'F1') },
      },
      { key: 'invalid_project-', text: 'says invalid_project', link: null },
    ]);
  });

  it('names the question in the language of the page', () => {
    const [first] = noticeReasonsOf(REASONS, 'p1', 'ar', () => '');
    expect(first?.link?.label).toBe('التكلفة المتغيرة لكل وحدة');
  });
});
