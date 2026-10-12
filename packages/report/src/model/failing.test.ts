import { CRITERION_IDS } from '@sbn/engine';
import { describe, expect, it } from 'vitest';
import { ar, en } from '../messages';
import { modelOf, sectionOf, tablesOf } from '../testing/model-helpers';
import { inlineText } from './inline';

const answered = (value: unknown) => ({ status: 'answered' as const, value });

/** A project that fails every criterion of the verdict: the report must say so in every one. */
const everythingWrong = (a: Record<string, unknown>) => {
  a.F1 = answered({ amount: 12, currency: 'JOD' });
  a['F2.1'] = answered(60);
  a.E7 = answered(50);
  a.A7 = answered('lt3');
  a.H5 = answered('m6');
  a.A5 = answered({ min: 1000, max: 2000, currency: 'JOD' });
  a.H3 = answered({ values: ['self'] });
};

describe('a project that fails every criterion', () => {
  for (const messages of [ar, en]) {
    const locale = messages === ar ? 'ar' : 'en';
    it(`lists each failing criterion (the margin is fine here) with its measured value and its limit in ${locale}`, () => {
      const model = modelOf('jo-service-subscription', locale, { change: everythingWrong });
      const blocks = sectionOf(model, 'executive_summary').blocks;
      const table = tablesOf(blocks).find(
        (candidate) => candidate.caption[0] === messages.executive.blocksCaption,
      );
      const heads = table?.rows.map((row) => inlineText(row.head ?? [])) ?? [];
      expect(heads.sort()).toEqual(
        CRITERION_IDS.filter((id) => id !== 'margin_positive')
          .map((id) => messages.executive.criteria[id])
          .sort(),
      );
      for (const row of table?.rows ?? []) {
        expect(row.cells).toHaveLength(2);
        for (const cell of row.cells) expect(inlineText(cell.text).trim()).not.toBe('');
      }
    });
  }

  it('is a stop with no change in range: the rethink list fills the three places (D-228)', () => {
    const model = modelOf('jo-service-subscription', 'ar', { change: everythingWrong });
    const blocks = sectionOf(model, 'executive_summary').blocks;
    expect(blocks.find((block) => block.type === 'verdict')).toMatchObject({ code: 'stop' });
    expect(
      tablesOf(blocks).some((table) => table.caption[0] === ar.executive.changesCaption.stop),
    ).toBe(false);
    const rethink = blocks.find(
      (block) => block.type === 'list' && block.title?.[0] === ar.executive.rethinkTitle,
    );
    expect(rethink?.type === 'list' ? rethink.items : []).toHaveLength(3);
  });

  it('puts the funding blocker, the lost break-even and the customer value among the first risks', () => {
    const model = modelOf('jo-service-subscription', 'en', { change: everythingWrong });
    const blocks = sectionOf(model, 'executive_summary').blocks;
    const risks = blocks.find(
      (block) => block.type === 'list' && block.title?.[0] === en.executive.risksTitle,
    );
    const text = risks?.type === 'list' ? risks.items.map(inlineText).join('\n') : '';
    expect(text).toContain('No break-even within 36 months in the base case.');
    expect(text).toContain('exceeds your largest available capital');
    expect(risks?.type === 'list' ? risks.items : []).toHaveLength(3);
  });

  it('does not suggest a change the tornado cannot support', () => {
    const model = modelOf('jo-service-subscription', 'en', { change: everythingWrong });
    expect(JSON.stringify(sectionOf(model, 'executive_summary').blocks)).toContain(
      en.executive.rethinkTitle,
    );
  });
});

describe('the reasons a summary gives for answers it cannot calculate', () => {
  it('names a question of the diagnostic or one of its follow-ups by its own title', () => {
    const model = modelOf('jo-service-subscription', 'en', {
      kind: 'summary',
      withoutRun: [
        { code: 'missing_answer', questionId: 'D4' },
        { code: 'invalid_value', questionId: 'F4.1', item: 'rent' },
      ],
    });
    const text = JSON.stringify(sectionOf(model, 'break_even').blocks);
    expect(text).toContain('What do these competitors charge?');
    expect(text).toContain('The value of ');
  });
});
