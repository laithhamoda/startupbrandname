import { describe, expect, it } from 'vitest';
import { ar, messagesFor } from '../messages';
import { LOCALES, NAMES, modelOf, sectionOf } from '../testing/model-helpers';
import { drop, goldenReportInput } from '../testing/report-inputs';
import { buildReportModel } from './build';
import { modelText, stringsOf } from '../testing/model-text';
import { inlineText } from './inline';
import { FULL_SECTION_IDS, type Section } from './types';

const OPEN = ['verdict', 'project_card', 'top_risks', 'break_even'];
const VERDICT_OF: Readonly<Record<string, 'go' | 'revise' | 'stop'>> = {
  'jo-service-subscription': 'revise',
  'jo-home-ecommerce': 'stop',
  'dz-auto-entrepreneur': 'go',
};

describe('the one-page summary (SPEC section 6)', () => {
  for (const name of NAMES) {
    for (const locale of LOCALES) {
      describe(`${name} in ${locale}`, () => {
        const model = modelOf(name, locale, { kind: 'summary', lockReason: 'plan' });

        it('has the verdict, the card, the risks and the break-even open, and every other section as a locked title', () => {
          expect(model.kind).toBe('summary');
          expect(model.lockReason).toBe('plan');
          expect(
            model.sections.filter((section) => !section.locked).map((section) => section.id),
          ).toEqual(OPEN);
          const locked = model.sections.filter((section) => section.locked);
          expect(locked.map((section) => section.id)).toEqual(
            FULL_SECTION_IDS.filter((id) => id !== 'project_card'),
          );
          for (const section of locked) {
            expect(section.blocks, section.id).toEqual([]);
            expect(section.title.length).toBeGreaterThan(0);
          }
        });

        it('shows the verdict word and one generic sentence, and no score, meter or key numbers (D-278)', () => {
          const section = model.sections[0];
          expect(section?.id).toBe('verdict');
          const block = section?.blocks[0];
          const code = VERDICT_OF[name];
          expect(block?.type).toBe('verdict');
          if (block?.type !== 'verdict' || code === undefined) return;
          const words = messagesFor(locale);
          expect(block.code).toBe(code);
          expect(block.word).toBe(words.verdictWords[code]);
          expect(block.meter).toBeNull();
          expect(inlineText(block.reason)).toBe(words.summaryVerdict[code]);
          expect(block.stopSentence).toBe(code === 'stop' ? words.stopSentence : null);
          const all = model.sections.flatMap((entry) => entry.blocks);
          expect(all.some((entry) => entry.type === 'keyNumbers')).toBe(false);
          expect(all.filter((entry) => entry.type === 'verdict')).toHaveLength(1);
        });

        it('holds nothing more than the word and the sentence for a go or a revise (and the before-tax note, D-292), and the three changes for a stop', () => {
          const blocks = model.sections[0]?.blocks ?? [];
          const notes = blocks.filter((entry) => entry.type === 'note');
          expect(notes.length).toBeLessThanOrEqual(1);
          if (VERDICT_OF[name] !== 'stop') {
            expect(blocks).toHaveLength(1 + notes.length);
            return;
          }
          const table = blocks.find((entry) => entry.type === 'table');
          expect(table?.type === 'table' ? table.rows : []).toHaveLength(3);
        });

        it('lists at most three risks', () => {
          const risks = sectionOf(model, 'top_risks').blocks[0];
          expect(risks?.type === 'list' ? risks.items.length : 0).toBeLessThanOrEqual(3);
          expect(risks?.type === 'list' ? risks.items.length : 0).toBeGreaterThan(0);
        });

        it('is JSON-safe and deterministic', () => {
          expect(JSON.parse(JSON.stringify(model))).toStrictEqual(model);
          expect(modelOf(name, locale, { kind: 'summary', lockReason: 'plan' })).toStrictEqual(
            model,
          );
        });
      });
    }
  }

  it('records why it is locked: a plan, or answers that are not complete enough', () => {
    expect(
      modelOf(NAMES[0] ?? 'jo-service-subscription', 'ar', { kind: 'summary' }).lockReason,
    ).toBe('plan');
    expect(
      modelOf('jo-service-subscription', 'ar', { kind: 'summary', lockReason: 'completeness' })
        .lockReason,
    ).toBe('completeness');
  });

  it('estimates the break-even: the month, the units and the revenue', () => {
    const model = modelOf('jo-service-subscription', 'ar', { kind: 'summary' });
    const text = modelText({ ...model, sections: [sectionOf(model, 'break_even')] });
    expect(text).toContain('الشهر 6');
    expect(text).toContain('171 وحدة');
    expect(text).toContain('5,125.000');
    expect(text).toContain(ar.breakEven.caveat);
  });

  it('is built from a trimmed answer set as well: the card shows and the estimate waits', () => {
    const model = modelOf('jo-service-subscription', 'ar', {
      kind: 'summary',
      lockReason: 'completeness',
      withoutRun: [{ code: 'missing_answer', questionId: 'F3' }],
      change: (answers) => {
        drop(answers, 'F3', 'F4', 'F5', 'F6', 'D4', 'E8');
      },
    });
    expect(model.meta.engineVersion).toBeNull();
    expect(model.sections.filter((section) => !section.locked)).toHaveLength(3);
    // No calculable run, no verdict: the section is absent, not locked (D-278).
    expect(model.sections.some((section) => section.id === 'verdict')).toBe(false);
  });
});

describe('the verdict says when tax was not calculated (D-292)', () => {
  const noTax = { kind: 'summary', lockReason: 'plan', tax: { rules: [] } } as const;

  for (const name of NAMES) {
    for (const locale of LOCALES) {
      it(`puts the before-tax sentence right after the word: ${name} in ${locale}`, () => {
        const blocks = modelOf(name, locale, noTax).sections[0]?.blocks ?? [];
        const note = blocks[1];
        expect(blocks[0]?.type).toBe('verdict');
        expect(note?.type).toBe('note');
        expect(note?.type === 'note' ? inlineText(note.text) : '').toBe(
          messagesFor(locale).executive.beforeTax,
        );
      });
    }
  }

  it('keeps a stop’s three changes after the sentence, so the note never replaces them', () => {
    const blocks = modelOf('jo-home-ecommerce', 'en', noTax).sections[0]?.blocks ?? [];
    expect(blocks.map((entry) => entry.type).slice(0, 2)).toEqual(['verdict', 'note']);
    const table = blocks.find((entry) => entry.type === 'table');
    expect(table?.type === 'table' ? table.rows : []).toHaveLength(3);
  });

  it('says nothing about tax when a regime was calculated', () => {
    const blocks = modelOf('jo-service-subscription', 'en', { kind: 'summary', lockReason: 'plan' })
      .sections[0]?.blocks;
    expect(blocks?.map((entry) => entry.type)).toEqual(['verdict']);
  });
});

describe('a stop whose changes could not be searched (D-278)', () => {
  it('says so in words and shows no invented change', () => {
    const input = goldenReportInput('jo-home-ecommerce', {
      locale: 'en',
      kind: 'summary',
      lockReason: 'plan',
    });
    const model = buildReportModel({ ...input, changes: null });
    const blocks = model.sections[0]?.blocks ?? [];
    expect(blocks.some((entry) => entry.type === 'table')).toBe(false);
    expect(blocks.some((entry) => entry.type === 'paragraph')).toBe(true);
  });
});

describe('no locked value reaches the summary (D-232)', () => {
  const lockedOf = (model: ReturnType<typeof modelOf>): Section[] => {
    const summary = modelOf('jo-service-subscription', 'ar', { kind: 'summary' });
    const ids = new Set(
      summary.sections.filter((section) => section.locked).map((section) => section.id),
    );
    return model.sections.filter((section) => ids.has(section.id));
  };

  for (const name of NAMES) {
    for (const locale of LOCALES) {
      describe(`${name} in ${locale}`, () => {
        const full = modelOf(name, locale);
        const summary = modelOf(name, locale, { kind: 'summary' });
        const text = JSON.stringify(summary);

        it('holds no block of a locked section, only its title', () => {
          for (const section of summary.sections.filter((entry) => entry.locked)) {
            expect(JSON.stringify(section), section.id).toBe(
              JSON.stringify({ id: section.id, title: section.title, locked: true, blocks: [] }),
            );
          }
        });

        it('holds no block of a locked section of the full report, anywhere', () => {
          // The one exemption is the verdict section (D-278): the changes block of a stop is the
          // very block the executive summary builds, so it may occur in both.
          const exempt = new Set(
            summary.sections
              .filter((section) => section.id === 'verdict')
              .flatMap((section) => section.blocks.map((block) => JSON.stringify(block))),
          );
          const blocks = lockedOf(full).flatMap((section) => section.blocks);
          expect(blocks.length).toBeGreaterThan(50);
          for (const block of blocks) {
            if (exempt.has(JSON.stringify(block))) continue;
            expect(text.includes(JSON.stringify(block))).toBe(false);
          }
        });

        it('holds no string of a locked section except those of the verdict section (D-278)', () => {
          const allowed = new Set(
            summary.sections
              .filter((entry) => entry.id === 'verdict')
              .flatMap((entry) => stringsOf(entry.blocks)),
          );
          const open = new Set(
            summary.sections
              .filter((entry) => !entry.locked && entry.id !== 'verdict')
              .flatMap((entry) => stringsOf(entry.blocks)),
          );
          const tokens = new Set(stringsOf(summary.sections.map((entry) => entry.blocks)));
          const leaked = [
            ...new Set(lockedOf(full).flatMap((entry) => stringsOf(entry.blocks))),
          ].filter(
            (candidate) =>
              candidate.length >= 8 &&
              tokens.has(candidate) &&
              !allowed.has(candidate) &&
              !open.has(candidate),
          );
          expect(leaked).toEqual([]);
        });

        it('holds none of the numbers only a locked section computes', () => {
          // The card, the risks and the estimate share numbers with the locked sections by design
          // (a risk quotes the figures of its alert). A number that only a locked section holds,
          // such as a monthly line of the projection, must not be anywhere in the summary.
          const shown = new Set([
            ...summary.sections
              .filter((entry) => !entry.locked)
              .flatMap((entry) => stringsOf(entry.blocks)),
            // The meta holds the day and the engine version, which the cover repeats.
            ...stringsOf(summary.meta),
          ]);
          const tokens = new Set(stringsOf(summary));
          const numbers = [
            ...new Set(lockedOf(full).flatMap((entry) => stringsOf(entry.blocks))),
          ].filter(
            (candidate) =>
              /[0-9]/.test(candidate) && candidate.length >= 5 && !shown.has(candidate),
          );
          expect(numbers.length).toBeGreaterThan(20);
          expect(numbers.filter((candidate) => tokens.has(candidate))).toEqual([]);
        });
      });
    }
  }

  it('does not change when only an answer that feeds a locked section changes', () => {
    // B8 (the unfair advantage) and B3 feed the canvases and nothing else the summary reads.
    const change = (answers: Record<string, unknown>) => {
      answers.B8 = { status: 'answered', value: 'علاقة طويلة ومباشرة مع كبار الموردين المحليين' };
      answers.B3 = { status: 'answered', value: 'العيادات الصغيرة التي تدير حجوزاتها بالورق' };
    };
    const base = modelOf('jo-service-subscription', 'ar', { kind: 'summary' });
    const changed = modelOf('jo-service-subscription', 'ar', { kind: 'summary', change });
    expect(changed).toStrictEqual(base);
    // The same change is seen in the full report, so the comparison is not vacuous.
    expect(modelOf('jo-service-subscription', 'ar', { change })).not.toStrictEqual(
      modelOf('jo-service-subscription', 'ar'),
    );
  });

  it('would notice a leak: a block of the full report is found in the full report', () => {
    const full = modelOf('jo-service-subscription', 'ar');
    const text = JSON.stringify(full);
    const blocks = lockedOf(full).flatMap((section) => section.blocks);
    expect(blocks.every((block) => text.includes(JSON.stringify(block)))).toBe(true);
  });
});
