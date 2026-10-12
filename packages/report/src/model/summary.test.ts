import { describe, expect, it } from 'vitest';
import { ar } from '../messages';
import { LOCALES, NAMES, modelOf, sectionOf } from '../testing/model-helpers';
import { drop } from '../testing/report-inputs';
import { modelText, stringsOf } from '../testing/model-text';
import { FULL_SECTION_IDS, type Section } from './types';

const OPEN = ['project_card', 'top_risks', 'break_even'];

describe('the one-page summary (SPEC section 6)', () => {
  for (const name of NAMES) {
    for (const locale of LOCALES) {
      describe(`${name} in ${locale}`, () => {
        const model = modelOf(name, locale, { kind: 'summary', lockReason: 'plan' });

        it('has the card, the risks and the break-even open, and every other section as a locked title', () => {
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

        it('shows no verdict and no key numbers: the verdict belongs to the executive summary (D-268)', () => {
          const blocks = model.sections.flatMap((section) => section.blocks);
          expect(blocks.some((block) => block.type === 'verdict')).toBe(false);
          expect(blocks.some((block) => block.type === 'keyNumbers')).toBe(false);
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
          const blocks = lockedOf(full).flatMap((section) => section.blocks);
          expect(blocks.length).toBeGreaterThan(50);
          for (const block of blocks) {
            expect(text.includes(JSON.stringify(block))).toBe(false);
          }
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
