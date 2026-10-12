import type { Answers, StepId } from '@sbn/question-bank';
import { sampleAnswers } from '@sbn/question-bank/testing';
import {
  buildBusinessModelCanvas,
  buildLeanCanvas,
  CANVAS_MAP,
  type CanvasInput,
  type ChipProvenance,
} from '@sbn/report/canvas';
import { NextIntlClientProvider } from 'next-intl';
import { type ComponentProps, createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { catalogues } from '@/i18n/messages';
import type { Locale } from '@/i18n/routing';
import { CanvasBoard } from './canvas-board';

// next-intl's navigation needs a running Next.js app. The board only needs links with the language
// prefix, and the busy line of a link has nothing to show in static markup.
vi.mock('@/i18n/navigation', async () => {
  const { createElement: element } = await import('react');
  const { useLocale } = await import('next-intl');
  return {
    Link: ({ href, children, ...props }: { href: string; children?: ReactNode }) =>
      element('a', { href: `/${useLocale()}${href}`, ...props }, children),
  };
});
vi.mock('@/components/ui/link-pending', () => ({ LinkPending: () => null }));

const PROJECT = '6f1c1f1e-7d4b-4c55-9a51-0f6f5d2b9e10';
const hrefFor = (step: StepId) => `/projects/${PROJECT}/q/${step.replace('.', '-')}?from=canvas`;

const user: ChipProvenance = { source: 'user', confidence: 'medium', validated: false };
const assumption: ChipProvenance = { source: 'assumption', confidence: 'low', validated: false };
const external: ChipProvenance = { source: 'external', confidence: 'high', validated: true };

const answered = (value: unknown) => ({ status: 'answered' as const, value });

function inputOf(language: Locale, changes: Partial<CanvasInput> = {}, answers?: Answers) {
  return {
    language,
    answers: answers ?? {
      ...sampleAnswers(),
      'C7.1': answered('متابعة بعد أسبوع'),
      'F4.1': answered({ amount: 120, currency: 'JOD' }),
    },
    provenance: { F1: external, D5: assumption, B1: user },
    currencyLabel: (code: string) => (language === 'ar' && code === 'JOD' ? 'د.أ' : code),
    ...changes,
  } satisfies CanvasInput;
}

function render(
  locale: Locale,
  model: ReturnType<typeof buildBusinessModelCanvas>,
  props: { englishTerms?: Parameters<typeof CanvasBoard>[0]['englishTerms'] } = {},
): string {
  return renderToStaticMarkup(
    createElement(
      NextIntlClientProvider,
      { locale, messages: catalogues[locale], timeZone: 'UTC' } as ComponentProps<
        typeof NextIntlClientProvider
      >,
      createElement(CanvasBoard, { model, hrefFor, idPrefix: 'test', ...props }),
    ),
  );
}

/** The markup of one block: its section, from its heading id to the next block. */
function blockMarkup(html: string, id: string): string {
  const start = html.indexOf(`aria-labelledby="test-${id}"`);
  if (start === -1) throw new Error(`no block ${id}`);
  return html.slice(start, html.indexOf('</section>', start));
}

describe.each(['ar', 'en'] as const)('the canvas board (%s)', (locale) => {
  const messages = catalogues[locale].canvas;
  const bmc = render(locale, buildBusinessModelCanvas(inputOf(locale)));

  it('is nine labelled regions, each named by its heading', () => {
    expect(bmc.match(/<section /g)).toHaveLength(9);
    for (const { id } of CANVAS_MAP.business_model) {
      const block = blockMarkup(bmc, id);
      expect(block).toContain(`<h3 id="test-${id}"`);
      expect(block).toContain(messages.block[id]);
    }
  });

  it('is laid out left to right with the words of each block in the page direction', () => {
    expect(bmc).toContain('dir="ltr" class="grid gap-px');
    const direction = locale === 'ar' ? 'rtl' : 'ltr';
    expect(
      bmc.match(new RegExp(`<section aria-labelledby="[^"]*" dir="${direction}"`, 'g')),
    ).toHaveLength(9);
  });

  it('puts the blocks in the standard geometry: the customer on the right, costs under the others', () => {
    const place = (id: string) => /class="[^"]*"/.exec(blockMarkup(bmc, id))?.[0] ?? '';
    // Physical columns from the left (D-051): partners, activities and resources, value, the
    // relationships and channels, then the customer segments at the far right.
    expect(place('keyPartners')).toContain('lg:col-start-1');
    expect(place('keyActivities')).toContain('lg:col-start-3');
    expect(place('keyResources')).toContain('lg:row-start-2');
    expect(place('valuePropositions')).toContain('lg:col-start-5');
    expect(place('customerRelationships')).toContain('lg:row-start-1');
    expect(place('channels')).toContain('lg:col-start-7');
    expect(place('channels')).toContain('lg:row-start-2');
    expect(place('customerSegments')).toContain('lg:col-start-9');
    expect(place('customerSegments')).toContain('lg:row-span-2');
    expect(place('costStructure')).toContain('lg:col-start-1');
    expect(place('costStructure')).toContain('lg:row-start-3');
    expect(place('revenueStreams')).toContain('lg:col-start-6');
    expect(place('revenueStreams')).toContain('lg:row-start-3');
  });

  it('has square cells with no shadow, one hairline between them', () => {
    // The marks are dots and diamonds; the cells themselves are square.
    const cells = bmc.match(/<section [^>]*>/g) ?? [];
    expect(cells).toHaveLength(9);
    for (const cell of cells) expect(cell).not.toMatch(/rounded|shadow/);
    expect(bmc).not.toContain('shadow');
    expect(bmc).toContain('bg-hairline');
  });

  it('makes a chip a link to the question that holds its answer, and back', () => {
    const block = blockMarkup(bmc, 'valuePropositions');
    expect(block).toContain(`href="/${locale}/projects/${PROJECT}/q/B1?from=canvas"`);
    expect(block).toContain(`href="/${locale}/projects/${PROJECT}/q/D5?from=canvas"`);
    // The follow-up has its URL without the dot.
    expect(blockMarkup(bmc, 'customerRelationships')).toContain(
      `href="/${locale}/projects/${PROJECT}/q/C7-1?from=canvas"`,
    );
    expect(block).toContain(messages.edit);
  });

  it('names what each chip is, in words as well as a mark', () => {
    const block = blockMarkup(bmc, 'revenueStreams');
    expect(block).toContain(messages.source.F1);
    expect(block).toContain(messages.source.F7);
    // The mark is for the eye; the source is said in words for everyone else.
    expect(block).toContain(
      `<span class="sr-only">${catalogues[locale].provenance.external}</span>`,
    );
    expect(blockMarkup(bmc, 'valuePropositions')).toContain(
      `<span class="sr-only">${catalogues[locale].provenance.assumption}</span>`,
    );
  });

  it('has a legend with the three marks and their words', () => {
    expect(bmc).toContain(`aria-label="${messages.legend}"`);
    for (const word of Object.values(catalogues[locale].provenance)) expect(bmc).toContain(word);
    expect(bmc).toContain('border-dashed'); // the assumption ring
    expect(bmc).toContain('rotate-45'); // the external diamond
    expect(bmc.match(/aria-hidden="true"/g)?.length).toBeGreaterThanOrEqual(3);
  });

  it('shows the founder’s own words and numbers, with digits isolated', () => {
    const block = blockMarkup(bmc, 'revenueStreams');
    expect(block).toContain('<bdi class="num">25</bdi>');
    expect(block).toContain(locale === 'ar' ? ' د.أ' : ' JOD');
  });

  it('shows the engine’s totals under the cost structure only', () => {
    const withTotals = render(
      locale,
      buildBusinessModelCanvas(
        inputOf(locale, {
          totals: [
            {
              kind: 'fixedMonthly',
              text: `300 ${locale === 'ar' ? 'د.أ' : 'JOD'}`,
              provenance: user,
            },
            { kind: 'setup', text: '1500 JOD', provenance: assumption },
          ],
        }),
      ),
    );
    const costs = blockMarkup(withTotals, 'costStructure');
    expect(costs).toContain(messages.totalsTitle);
    expect(costs).toContain(messages.total.fixedMonthly);
    expect(costs).toContain('<bdi class="num">300</bdi>');
    expect(costs).toContain(messages.total.setup);
    expect(withTotals.match(new RegExp(messages.totalsTitle, 'g'))).toHaveLength(1);
    expect(bmc).not.toContain(messages.totalsTitle);
  });

  describe('an empty block', () => {
    const answers = {
      ...sampleAnswers(),
      H1: { status: 'unknown' as const },
      H2: { status: 'unknown' as const },
    };
    delete answers.B8;
    const lean = render(locale, buildLeanCanvas(inputOf(locale, {}, answers)));

    it('says why, and links to the question that fills it', () => {
      const unfair = blockMarkup(lean, 'unfairAdvantage');
      expect(unfair).toContain(messages.empty.unanswered);
      expect(unfair).toContain(`href="/${locale}/projects/${PROJECT}/q/B8?from=canvas"`);
      expect(unfair).not.toContain('<ul');
    });

    it('tells «لا أعرف» from a question never answered', () => {
      const metrics = blockMarkup(lean, 'keyMetrics');
      expect(metrics).toContain(messages.empty.unknown);
      expect(metrics).toContain(`/q/H2?from=canvas`);
    });

    it('shows a reason in the empty project for every block, never text of its own', () => {
      const none = render(locale, buildBusinessModelCanvas(inputOf(locale, {}, {})));
      expect(none.match(new RegExp(messages.empty.unanswered, 'g'))).toHaveLength(9);
      expect(none).not.toContain('<ul class="grid gap-1.5"');
    });
  });

  it('cuts a long text in the box, not in the page', () => {
    const long = 'نص طويل جدًا '.repeat(120);
    const html = render(
      locale,
      buildBusinessModelCanvas(inputOf(locale, {}, { ...sampleAnswers(), B2: answered(long) })),
    );
    expect(html).toContain('line-clamp-6');
    expect(html).toContain(long.trim().slice(0, 60));
  });
});

describe('the English term beside an Arabic block name (CLAUDE.md §3)', () => {
  const model = buildBusinessModelCanvas(inputOf('ar'));

  it('is shown for the blocks listed, in Arabic only', () => {
    const html = render('ar', model, { englishTerms: ['customerSegments'] });
    expect(blockMarkup(html, 'customerSegments')).toContain(
      `(<bdi lang="en">${catalogues.ar.canvas.term.customerSegments}</bdi>)`,
    );
    expect(blockMarkup(html, 'channels')).not.toContain('lang="en"');
    expect(render('ar', model)).not.toContain('lang="en"');
  });

  it('is never shown in English, which is the term already', () => {
    const html = render('en', buildBusinessModelCanvas(inputOf('en')), {
      englishTerms: ['customerSegments'],
    });
    expect(html).not.toContain('lang="en"');
  });
});

describe('the Lean Canvas', () => {
  it('uses the geometry of the Lean Canvas, the customer still at the far right', () => {
    const html = render('en', buildLeanCanvas(inputOf('en')));
    const place = (id: string) => /class="[^"]*"/.exec(blockMarkup(html, id))?.[0] ?? '';
    expect(html.match(/<section /g)).toHaveLength(9);
    expect(place('problem')).toContain('lg:col-start-1');
    expect(place('solution')).toContain('lg:col-start-3');
    expect(place('keyMetrics')).toContain('lg:row-start-2');
    expect(place('uniqueValueProposition')).toContain('lg:col-start-5');
    expect(place('unfairAdvantage')).toContain('lg:col-start-7');
    expect(place('channels')).toContain('lg:row-start-2');
    expect(place('customerSegments')).toContain('lg:col-start-9');
  });

  it('shows the existing alternatives among the problem’s chips', () => {
    const html = render('en', buildLeanCanvas(inputOf('en')));
    const problem = blockMarkup(html, 'problem');
    expect(problem).toContain(catalogues.en.canvas.source.D3);
    expect(problem).toContain('/q/D3?from=canvas');
  });
});

describe('the catalogues of the canvas', () => {
  const sources = Object.values(CANVAS_MAP)
    .flat()
    .flatMap((block) => block.sources.map((source) => source.id));
  const blocks = Object.values(CANVAS_MAP).flatMap((map) => map.map((block) => block.id));

  it.each(['ar', 'en'] as const)('name every source and every block in %s', (locale) => {
    const { source, block, term } = catalogues[locale].canvas;
    for (const id of new Set(sources)) {
      expect(source, id).toHaveProperty(id.replace('.', '_'));
    }
    for (const id of new Set(blocks)) {
      expect(block, id).toHaveProperty(id);
      expect(term, id).toHaveProperty(id);
    }
  });

  it('keep the English terms in both languages, as written in the Lean Canvas and the BMC', () => {
    expect(catalogues.ar.canvas.term).toEqual(catalogues.en.canvas.term);
    expect(catalogues.en.canvas.block).toEqual(catalogues.en.canvas.term);
  });
});
