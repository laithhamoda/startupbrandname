import { describe, expect, it } from 'vitest';
import { ar, en, TERM_KEYS } from '../messages';
import { LOCALES, NAMES, modelOf, sectionOf, tablesOf } from '../testing/model-helpers';
import { modelInlines, stringsOf } from '../testing/model-text';
import { audienceOfAnswers } from './build';
import { KEY_NUMBER_ORDER } from './sections/executive';
import { FULL_SECTION_IDS, type Audience, type Block, type Inline } from './types';

const messagesOf = { ar, en };

const keyLabelsOf = (blocks: readonly Block[]): Inline[] =>
  blocks.flatMap((block) =>
    block.type === 'keyNumbers' ? block.items.map((item) => item.label) : [],
  );

describe('the full report', () => {
  for (const name of NAMES) {
    for (const locale of LOCALES) {
      describe(`${name} in ${locale}`, () => {
        const model = modelOf(name, locale);

        it('has the twelve sections of the MVP report, in order, all open', () => {
          expect(model.sections.map((section) => section.id)).toEqual(FULL_SECTION_IDS);
          expect(model.sections.every((section) => !section.locked)).toBe(true);
          expect(model.sections.every((section) => section.blocks.length > 0)).toBe(true);
          expect(model.sections.map((section) => section.title)).toEqual(
            FULL_SECTION_IDS.map((id) => messagesOf[locale].sections[id]),
          );
        });

        it('says what it is: version, language, kind, no lock and the facts of the cover', () => {
          expect(model.version).toBe(1);
          expect(model.locale).toBe(locale);
          expect(model.kind).toBe('full');
          expect(model.lockReason).toBeNull();
          expect(model.meta.issuedOn).toBe('2026-10-12');
          expect(model.meta.engineVersion).toMatch(/^\d+\.\d+\.\d+$/);
          expect(model.meta.confidence?.pivotal.map((figure) => figure.id)).toEqual([
            'F1',
            'F3',
            'F4',
            'F5',
            'F6',
          ]);
        });

        it('is JSON-safe: it survives a round trip through JSON unchanged', () => {
          expect(JSON.parse(JSON.stringify(model))).toEqual(model);
          // A bigint, undefined or function would not survive; strictly equal means none is there.
          expect(JSON.parse(JSON.stringify(model))).toStrictEqual(model);
        });

        it('is deterministic: the same input gives a deeply equal model', () => {
          expect(modelOf(name, locale)).toStrictEqual(model);
        });

        it('writes numbers in Western digits only', () => {
          expect(/[٠-٩۰-۹]/.test(JSON.stringify(model))).toBe(false);
        });

        it('keeps the founder’s own words as plain text parts, never as numbers or fragments', () => {
          const worry = JSON.stringify(model).includes('هل ');
          expect(typeof worry).toBe('boolean');
          for (const inline of modelInlines(model)) {
            for (const part of inline) {
              if (typeof part !== 'string') expect(Object.keys(part)).toHaveLength(1);
            }
          }
        });
      });
    }
  }
});

describe('the verdict', () => {
  it('stop (the shop): the fixed sentence and exactly three changes', () => {
    const model = modelOf('jo-home-ecommerce', 'ar');
    const blocks = sectionOf(model, 'executive_summary').blocks;
    const verdict = blocks.find((block) => block.type === 'verdict');
    expect(verdict).toMatchObject({
      code: 'stop',
      word: 'توقّف',
      stopSentence: 'غير قابل للتنفيذ بصيغته الحالية',
    });
    const changes = tablesOf(blocks).find(
      (table) => table.caption[0] === ar.executive.changesCaption.stop,
    );
    const rethink = blocks.find(
      (block) => block.type === 'list' && block.title?.[0] === ar.executive.rethinkTitle,
    );
    const rethinkCount = rethink?.type === 'list' ? rethink.items.length : 0;
    expect((changes?.rows.length ?? 0) + rethinkCount).toBe(3);
  });

  it('go (the Algerian project): no changes, no table of blockers, no stop sentence', () => {
    const model = modelOf('dz-auto-entrepreneur', 'ar');
    const blocks = sectionOf(model, 'executive_summary').blocks;
    expect(blocks.find((block) => block.type === 'verdict')).toMatchObject({
      code: 'go',
      word: 'امضِ',
      stopSentence: null,
    });
    const captions = tablesOf(blocks).map((table) => table.caption[0]);
    expect(captions).toEqual([]);
    expect(
      blocks.some(
        (block) => block.type === 'list' && block.title?.[0] === ar.executive.rethinkTitle,
      ),
    ).toBe(false);
  });

  it('revise (the Jordanian service): up to three changes and the premium sentence on the price', () => {
    const model = modelOf('jo-service-subscription', 'ar');
    const blocks = sectionOf(model, 'executive_summary').blocks;
    expect(blocks.find((block) => block.type === 'verdict')).toMatchObject({
      code: 'revise',
      word: 'عدّل',
      stopSentence: null,
    });
    const table = tablesOf(blocks).find(
      (candidate) => candidate.caption[0] === ar.executive.changesCaption.revise,
    );
    expect(table?.rows.length).toBeLessThanOrEqual(3);
    const premium = ar.executive.premiumNote({ ceiling: [{ n: '35.000' }, ' ', 'د.أ'] });
    const notes = table?.rows.map((row) => JSON.stringify(row.note)) ?? [];
    expect(notes.filter((note) => note === JSON.stringify(premium))).toHaveLength(1);
  });

  it('puts the verdict words of D-227 in English too', () => {
    const verdicts = NAMES.map((name) =>
      sectionOf(modelOf(name, 'en'), 'executive_summary').blocks.find(
        (block) => block.type === 'verdict',
      ),
    );
    expect(verdicts.map((block) => (block?.type === 'verdict' ? block.word : ''))).toEqual([
      'Revise',
      'Stop',
      'Go',
    ]);
    expect(verdicts[1]).toMatchObject({ stopSentence: 'Not viable in its current form' });
  });

  it('draws the meter from the score and the line of the verdict', () => {
    const verdict = sectionOf(
      modelOf('jo-service-subscription', 'ar'),
      'executive_summary',
    ).blocks.find((block) => block.type === 'verdict');
    expect(verdict?.type === 'verdict' ? verdict.meter : null).toMatchObject({
      passed: 6,
      evaluated: 10,
      linePercent: 75,
    });
  });
});

describe('the audience (D-236, D-269)', () => {
  const audiences: readonly Audience[] = ['investor', 'bank', 'grant', 'course', 'self'];

  for (const locale of LOCALES) {
    it(`changes the opening sentence and the order of the three numbers in ${locale}`, () => {
      const messages = messagesOf[locale];
      const words = messages.executive.keyNumbers;
      const label = {
        fundingNeed: words.fundingNeed,
        breakEven: words.breakEven,
        firstYearProfit: words.firstYearProfit,
      };
      for (const audience of audiences) {
        const model = modelOf('jo-service-subscription', locale, {
          change: (answers) => {
            const value = {
              investor: 'investor',
              bank: 'bank',
              grant: 'grant_body',
              course: 'course',
              self: 'self',
            }[audience];
            answers.H8 = { status: 'answered', value };
          },
        });
        expect(model.audience).toBe(audience);
        const blocks = sectionOf(model, 'executive_summary').blocks;
        expect(blocks[0]).toMatchObject({
          type: 'paragraph',
          text: [messages.executive.opening[audience]],
        });
        expect(keyLabelsOf(blocks).map((entry) => entry[0])).toEqual(
          KEY_NUMBER_ORDER[audience].map((id) => label[id]),
        );
      }
    });
  }

  it('maps the five options of H8, and "self" when it is unanswered or unknown', () => {
    const answered = (value: string) => ({ H8: { status: 'answered' as const, value } });
    expect(audienceOfAnswers(answered('investor'))).toBe('investor');
    expect(audienceOfAnswers(answered('bank'))).toBe('bank');
    expect(audienceOfAnswers(answered('grant_body'))).toBe('grant');
    expect(audienceOfAnswers(answered('course'))).toBe('course');
    expect(audienceOfAnswers(answered('self'))).toBe('self');
    expect(audienceOfAnswers({})).toBe('self');
    expect(audienceOfAnswers({ H8: { status: 'unknown' } })).toBe('self');
  });

  it('keeps the three numbers the same set whatever the audience', () => {
    for (const order of Object.values(KEY_NUMBER_ORDER)) {
      expect([...order].sort()).toEqual(['breakEven', 'firstYearProfit', 'fundingNeed']);
    }
  });
});

describe('the term tracker (D-270)', () => {
  /** Where the English term is glossed: the Arabic name followed by " (" and the English fragment. */
  function checkOrder(model: ReturnType<typeof modelOf>) {
    const seen = new Set<string>();
    for (const inline of modelInlines(model)) {
      inline.forEach((part, index) => {
        if (typeof part !== 'string') return;
        for (const key of TERM_KEYS) {
          const { name, english } = ar.terms[key];
          let from = part.indexOf(name);
          while (from >= 0) {
            const rest = part.slice(from + name.length);
            const next = inline[index + 1];
            const after = inline[index + 2];
            const glossed =
              rest === ' (' &&
              typeof next === 'object' &&
              'l' in next &&
              next.l === english &&
              typeof after === 'string' &&
              after.startsWith(')');
            if (seen.has(key)) {
              expect(glossed, `${key} is glossed again`).toBe(false);
            } else {
              expect(glossed, `${key} is not glossed on first use`).toBe(true);
              seen.add(key);
            }
            from = part.indexOf(name, from + name.length);
          }
        }
      });
    }
    return seen;
  }

  it('glosses each term once, on its first use, in reading order (Arabic)', () => {
    for (const name of NAMES) {
      const seen = checkOrder(modelOf(name, 'ar'));
      expect(seen.has('break_even')).toBe(true);
      expect(seen.has('payback')).toBe(true);
      expect(seen.has('sensitivity')).toBe(true);
    }
  });

  it('uses all seven terms in a subscription report', () => {
    expect(checkOrder(modelOf('jo-service-subscription', 'ar'))).toEqual(new Set(TERM_KEYS));
  });

  it('never glosses in English, where the term is already English', () => {
    for (const inline of modelInlines(modelOf('jo-service-subscription', 'en'))) {
      expect(
        inline.some((part) => typeof part === 'object' && 'l' in part && part.l === 'Break-even'),
      ).toBe(false);
    }
  });
});

describe('low-confidence pivotal figures (D-229)', () => {
  const lowPrice = (_answers: Record<string, unknown>, provenance: Record<string, unknown>) => {
    provenance.F1 = { source: 'user', confidence: 'low', validated: false };
  };

  it('highlights only the five pivotal figures, never another low-confidence number', () => {
    // F2.1 (churn) is a low-confidence guess in the Jordanian project, but it is not pivotal.
    const model = modelOf('jo-service-subscription', 'ar');
    expect(JSON.stringify(model)).not.toContain('"lowConfidence":true');
  });

  it('flags a low-confidence price on the card, in the economics and in the register', () => {
    const model = modelOf('jo-service-subscription', 'ar', { change: lowPrice });
    const flagged = model.sections
      .filter((section) => JSON.stringify(section.blocks).includes('"lowConfidence":true'))
      .map((section) => section.id);
    expect(flagged).toEqual(
      expect.arrayContaining([
        'project_card',
        'pricing_unit_economics',
        'validation_plan',
        'appendix_assumptions',
      ]),
    );
  });

  it('writes the sentence once at the end of each section that shows such a figure', () => {
    const model = modelOf('jo-service-subscription', 'ar', { change: lowPrice });
    for (const section of model.sections) {
      const sentences = section.blocks.filter(
        (block) => block.type === 'callout' && block.tone === 'low_confidence',
      );
      const shows = JSON.stringify(
        section.blocks.filter((block) => block.type !== 'callout'),
      ).includes('"lowConfidence":true');
      expect(sentences, section.id).toHaveLength(shows ? 1 : 0);
      if (shows) {
        expect(section.blocks.at(-1)).toMatchObject({
          type: 'callout',
          tone: 'low_confidence',
          text: ['هذا الرقم افتراض، اختبره قبل أن تبني عليه قراراً.'],
        });
      }
    }
  });

  it('uses the English sentence in the English report', () => {
    const model = modelOf('jo-service-subscription', 'en', { change: lowPrice });
    expect(JSON.stringify(model)).toContain(en.lowConfidence);
  });
});

describe('the cells', () => {
  it('carry the provenance of the figure they show', () => {
    const model = modelOf('jo-service-subscription', 'ar');
    const economics = tablesOf(sectionOf(model, 'pricing_unit_economics').blocks)[0];
    const price = economics?.rows[0]?.cells[0];
    expect(price?.provenance).toEqual({ source: 'user', confidence: 'high', validated: true });
    const margin = economics?.rows[3]?.cells[0];
    expect(margin?.provenance?.source).toBe('user');
  });

  it('mark the lowest cash balance and the break-even month in the projection', () => {
    const model = modelOf('jo-service-subscription', 'ar');
    const year = tablesOf(sectionOf(model, 'projection').blocks)[0];
    expect(year?.columns[5]?.mark).toBe('break_even');
    const cumulative = year?.rows.at(-1);
    expect(cumulative?.cells.map((cell) => cell.mark).indexOf('lowest_cash')).toBe(4);
    expect(stringsOf(year?.rows.at(-1)?.cells[4]?.text)).toEqual(['−18,400.000', ' د.أ']);
  });
});
