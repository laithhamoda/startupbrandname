import { describe, expect, it } from 'vitest';
import { PLANS, type PlanId } from '@/config/plans';
import { PUBLIC_PAGES } from '@/config/public-pages';
import { ABOUT } from './about';
import { FAQ } from './faq';
import { GLOSSARY } from './glossary';
import { HOME } from './home';
import { HOW_IT_WORKS } from './how-it-works';
import { AXIS_WEIGHTS, METHODOLOGY } from './methodology';
import { PAGE_META } from './pages';
import { PRICING } from './pricing';

/** The structure of a value without its text: keys, list lengths and value types. */
function shapeOf(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(shapeOf);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, inner]) => [key, shapeOf(inner)]),
    );
  }
  return typeof value;
}

const LOCALIZED = { PAGE_META, HOME, HOW_IT_WORKS, METHODOLOGY, PRICING, FAQ, ABOUT };

describe('public page content', () => {
  it.each(Object.entries(LOCALIZED))('%s has the same shape in English as in Arabic', (_, c) => {
    expect(shapeOf(c.en)).toEqual(shapeOf(c.ar));
  });

  it('describes every public page in both languages', () => {
    for (const locale of ['ar', 'en'] as const) {
      expect(Object.keys(PAGE_META[locale]).sort()).toEqual(
        PUBLIC_PAGES.map((page) => page.id).sort(),
      );
    }
  });

  it('keeps meta descriptions within what search results show', () => {
    for (const locale of ['ar', 'en'] as const) {
      for (const meta of Object.values(PAGE_META[locale])) {
        expect(meta.description.length, meta.description).toBeLessThanOrEqual(170);
      }
    }
  });

  it('uses unique anchors for steps, questions and glossary terms', () => {
    const ids = [
      ...HOW_IT_WORKS.ar.steps.map((step) => step.id),
      ...FAQ.ar.items.map((item) => item.id),
      ...GLOSSARY.map((term) => term.id),
    ];
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('keeps the same questions and steps in the same order in both languages', () => {
    expect(FAQ.en.items.map((item) => item.id)).toEqual(FAQ.ar.items.map((item) => item.id));
    expect(HOW_IT_WORKS.en.steps.map((step) => step.id)).toEqual(
      HOW_IT_WORKS.ar.steps.map((step) => step.id),
    );
  });
});

describe('methodology', () => {
  it('uses completeness weights that add up to 100 (docs/SPEC.md §3)', () => {
    expect(Object.values(AXIS_WEIGHTS).reduce((sum, weight) => sum + weight, 0)).toBe(100);
  });

  it('describes the eight axes in order', () => {
    expect(METHODOLOGY.ar.axes.map((axis) => axis.letter)).toEqual(Object.keys(AXIS_WEIGHTS));
  });
});

describe('pricing text', () => {
  it.each(['ar', 'en'] as const)('quotes the plan terms from the plan table (%s)', (locale) => {
    const { billing } = PRICING[locale];
    for (const [id, plan] of Object.entries(PLANS) as [PlanId, (typeof PLANS)[PlanId]][]) {
      if (plan.billing.kind === 'once') expect(billing[id]).toContain(String(plan.billing.days));
      if (plan.billing.kind === 'voucher') {
        expect(billing[id]).toContain(String(plan.billing.months));
      }
    }
  });

  it('marks only features that some plan includes as coming soon', () => {
    for (const feature of PRICING.ar.soonFeatures) {
      expect(Object.values(PLANS).some((plan) => plan.entitlements[feature])).toBe(true);
    }
  });

  it('matches the free plan in the FAQ answer', () => {
    const free = PLANS.free.entitlements;
    const answer = FAQ.en.items.find((item) => item.id === 'free')?.answer ?? '';
    expect(free.mentorMessages).toEqual({ kind: 'perDay', value: 3 });
    expect(answer).toContain('3 messages a day');
    expect(answer).toContain('30 days');
  });
});

describe('glossary', () => {
  it('defines about thirty terms, each in both languages', () => {
    expect(GLOSSARY.length).toBeGreaterThanOrEqual(30);
    for (const term of GLOSSARY) {
      expect(term.text.ar.term && term.text.ar.definition, term.id).toBeTruthy();
      expect(term.text.en.term && term.text.en.definition, term.id).toBeTruthy();
    }
  });

  it('uses URL-safe anchors', () => {
    for (const term of GLOSSARY) expect(term.id).toMatch(/^[a-z][a-z-]*$/);
  });
});
