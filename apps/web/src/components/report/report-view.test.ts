import { buildReportModel, type ReportModel } from '@sbn/report/model';
import { goldenReportInput } from '@sbn/report/testing/inputs';
import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { catalogues } from '@/i18n/messages';
import { httpsUrl } from './inline';
import { ReportView } from './report-view';

// next-intl's navigation needs a running Next.js app; the view only needs plain links.
vi.mock('@/i18n/navigation', async () => {
  const { createElement: element } = await import('react');
  return {
    Link: ({ href, children, ...props }: { href: string; children?: ReactNode }) =>
      element('a', { href, ...props }, children),
  };
});
vi.mock('@/components/ui/link-pending', () => ({ LinkPending: () => null }));

const HREFS = { project: '/projects/p1', pricing: '/pricing' } as const;

function modelOf(options: Parameters<typeof goldenReportInput>[1], over?: { title?: string }) {
  const input = goldenReportInput('jo-service-subscription', options);
  return buildReportModel(
    over?.title === undefined
      ? input
      : { ...input, project: { ...input.project, title: over.title } },
  );
}

function htmlOf(model: ReportModel, locale: 'ar' | 'en' = model.locale): string {
  return renderToStaticMarkup(
    createElement(ReportView, { model, labels: catalogues[locale].report, hrefs: HREFS }),
  );
}

const escapeHtml = (text: string) =>
  text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#x27;');

/** The fields of the model that hold a code or a switch, not a text the reader sees. */
const NOT_TEXT = new Set([
  'type',
  'tone',
  'kind',
  'code',
  'id',
  'key',
  'questionId',
  'labelCode',
  'source',
  'confidence',
  'mark',
  'align',
]);

/** Every piece of text a value holds: each string, and the number or fragment of each part. */
function textsOf(value: unknown, into = new Set<string>()): Set<string> {
  if (typeof value === 'string') {
    into.add(value);
  } else if (Array.isArray(value)) {
    for (const child of value as unknown[]) textsOf(child, into);
  } else if (typeof value === 'object' && value !== null) {
    for (const [field, child] of Object.entries(value)) {
      if (!NOT_TEXT.has(field)) textsOf(child, into);
    }
  }
  return into;
}

/**
 * The texts that only the full report's locked sections hold. The summary legitimately says some
 * of the same words: its open sections (the project card quotes the founder's idea, the risks quote
 * their figures), the cover facts and section titles of the model, and the page's own words. A
 * text counts as locked-only when none of those contains it, so a leak is a real one.
 */
function lockedOnlyTexts(full: ReportModel, summary: ReportModel, chrome: unknown): string[] {
  const open = new Set<string>();
  for (const section of summary.sections) {
    if (!section.locked) textsOf(section.blocks, open);
    open.add(section.title);
  }
  textsOf(summary.meta, open);
  textsOf(chrome, open);
  const allowed = [...open].join('\n');
  const lockedIds = new Set(summary.sections.filter((s) => s.locked).map((s) => s.id));
  const held = new Set<string>();
  for (const section of full.sections) {
    if (lockedIds.has(section.id)) textsOf(section.blocks, held);
  }
  return [...held].filter((text) => text.length >= 8 && !allowed.includes(text));
}

describe('the locked report page (D-232, D-276)', () => {
  const full = modelOf({ locale: 'ar', kind: 'full' });
  const locked = modelOf({ locale: 'ar', kind: 'summary', lockReason: 'plan' });
  const needles = lockedOnlyTexts(full, locked, catalogues.ar.report);

  it('has a real set of locked-only texts to look for', () => {
    expect(needles.length).toBeGreaterThan(100);
    // What the locked sections hold and the summary does not: the verdict's reason, the funding
    // need, a scenario value, a canvas text, a legal step, a validation text and an appendix value.
    const has = (fragment: string) => needles.some((text) => text.includes(fragment));
    const verdict = full.sections
      .flatMap((section) => section.blocks)
      .find((block) => block.type === 'verdict');
    const reason = verdict?.type === 'verdict' ? verdict.reason : [];
    expect(reason.some((part) => typeof part === 'string' && part.length >= 6 && has(part))).toBe(
      true,
    );
    expect(has('18,400.000')).toBe(true);
    expect(has('70,860.000')).toBe(true);
    expect(has('لوحة نموذج العمل')).toBe(true);
    expect(has('تسجيل مؤسسة فردية')).toBe(true);
    expect(has('خطة اختبار')).toBe(true);
    expect(has('افتراضات المحرك المسمّاة')).toBe(true);
  });

  it('keeps every locked-only text out of the locked page', () => {
    const html = htmlOf(locked);
    const leaked = needles.filter((text) => html.includes(escapeHtml(text)));
    expect(leaked).toEqual([]);
  });

  it('keeps every locked-only text out of the model that would cross to the browser', () => {
    const json = JSON.stringify({ model: locked, labels: catalogues.ar.report, hrefs: HREFS });
    const leaked = needles.filter((text) => json.includes(JSON.stringify(text).slice(1, -1)));
    expect(leaked).toEqual([]);
  });

  it('shows the same texts for the full report, so the check cannot pass by emptiness', () => {
    const html = htmlOf(full);
    const missing = needles.filter((text) => !html.includes(escapeHtml(text)));
    expect(missing).toEqual([]);
    const json = JSON.stringify(full);
    expect(needles.every((text) => json.includes(JSON.stringify(text).slice(1, -1)))).toBe(true);
  });

  it('holds no block in a locked section and draws its title, its note and the way to open it', () => {
    const lockedSections = locked.sections.filter((section) => section.locked);
    expect(lockedSections.length).toBeGreaterThan(5);
    for (const section of lockedSections) expect(section.blocks).toEqual([]);
    const html = htmlOf(locked);
    for (const section of lockedSections) expect(html).toContain(escapeHtml(section.title));
    expect(html).toContain(escapeHtml(catalogues.ar.report.lock.plan));
    expect(html).toContain('href="/pricing"');
    expect(html).not.toContain('data-report-reveal');
  });

  it('points a summary locked by the answers back to the questions', () => {
    const html = htmlOf(modelOf({ locale: 'ar', kind: 'summary', lockReason: 'completeness' }));
    expect(html).toContain(escapeHtml(catalogues.ar.report.lock.completeness));
    expect(html).toContain(`href="${HREFS.project}"`);
    expect(html).not.toContain(escapeHtml(catalogues.ar.report.lock.plan));
  });
});

describe('the full report page (D-274)', () => {
  const model = modelOf({ locale: 'ar', kind: 'full' });
  const html = htmlOf(model);

  it('has one h1, the project title, and an h2 for each section', () => {
    expect(html.match(/<h1[ >]/g)).toHaveLength(1);
    expect(html).toContain(escapeHtml(model.meta.title));
    expect(html.match(/<h2[ >]/g)).toHaveLength(model.sections.length);
  });

  it('has a contents list with an anchor for every section', () => {
    for (const section of model.sections) {
      expect(html).toContain(`href="#section-${section.id}"`);
      expect(html).toContain(`id="section-${section.id}"`);
    }
    expect(html).toContain('<details');
  });

  it('draws the verdict slab with its word, the reveal mark and the meter', () => {
    const verdict = model.sections
      .flatMap((section) => section.blocks)
      .find((block) => block.type === 'verdict');
    expect(verdict?.type).toBe('verdict');
    expect(html).toContain('data-report-reveal');
    expect(html).toContain('role="meter"');
    if (verdict?.type === 'verdict') expect(html).toContain(escapeHtml(verdict.word));
  });

  it('draws tables as labelled, focusable regions with scoped headers and the marks in a legend', () => {
    expect(html).toContain('role="region"');
    expect(html).toContain('tabindex="0"');
    expect(html).toContain('scope="col"');
    expect(html).toContain('scope="row"');
    expect(html).toContain(escapeHtml(catalogues.ar.report.legend.lowestCash));
    expect(html).toContain(escapeHtml(catalogues.ar.report.legend.breakEven));
    // The break-even month is marked in its column and the lowest cash balance in its cell, in words.
    expect(html).toContain(escapeHtml(catalogues.ar.report.marks.lowestCash));
  });

  it('isolates numbers left to right and the canvas is a left-to-right board', () => {
    expect(html).toMatch(/<bdi dir="ltr" class="num">18,400\.000<\/bdi>/);
    expect(html).toContain(
      'dir="ltr" class="grid gap-px border border-hairline bg-hairline lg:grid-cols-10"',
    );
  });

  it('opens links to outside pages in a new window without giving the page away', () => {
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).not.toMatch(/target="_blank"(?![^>]*noopener)/);
  });

  it('never sets HTML from a string', () => {
    expect(html).not.toContain('dangerouslySetInnerHTML');
  });

  it('draws the English model with English words', () => {
    const english = modelOf({ locale: 'en', kind: 'full' });
    const text = htmlOf(english, 'en');
    expect(text).toContain(escapeHtml(catalogues.en.report.contents.title));
    expect(text).toContain('Revise');
  });
});

describe('a founder text in the title', () => {
  it('is escaped, never read as markup', () => {
    const hostile = '<img src=x onerror=alert(1)> & "quotes"';
    const html = htmlOf(modelOf({ locale: 'ar', kind: 'full' }, { title: hostile }));
    expect(html).toContain(escapeHtml(hostile));
    expect(html).not.toContain('<img src=x');
  });
});

describe('httpsUrl', () => {
  it('keeps https addresses and refuses everything else', () => {
    expect(httpsUrl('https://example.invalid/a?b=1')).toBe('https://example.invalid/a?b=1');
    expect(httpsUrl('http://example.invalid/a')).toBeNull();
    expect(httpsUrl('javascript:alert(1)')).toBeNull();
    expect(httpsUrl('//example.invalid')).toBeNull();
    expect(httpsUrl('not a url')).toBeNull();
  });
});
