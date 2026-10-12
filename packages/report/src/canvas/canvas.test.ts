import type { Answer, Answers, StepId } from '@sbn/question-bank';
import { sampleAnswers } from '@sbn/question-bank/testing';
import { describe, expect, it } from 'vitest';
import {
  amountText,
  ASSUMED,
  buildBlocks,
  buildBusinessModelCanvas,
  buildLeanCanvas,
  CANVAS_MAP,
  type CanvasBlock,
  type CanvasInput,
  type CanvasModel,
  type ChipProvenance,
  fieldOfStep,
  fillingStep,
  plainNumber,
} from './index';

const answered = (value: unknown): Answer => ({ status: 'answered', value });
const unknown: Answer = { status: 'unknown' };

const label = (code: string) => (code === 'JOD' ? 'د.أ' : code);
const labelEn = (code: string) => code;

/** Every question answered as the question bank's sample, plus the follow-ups the canvas reads. */
function fullAnswers(changes: Answers = {}): Answers {
  return {
    ...sampleAnswers(),
    'C7.1': answered('متابعة بعد أسبوع من التسليم'),
    'F4.1': answered({ amount: 120, currency: 'JOD' }),
    ...changes,
  };
}

function inputOf(answers: Answers, changes: Partial<CanvasInput> = {}): CanvasInput {
  return { language: 'ar', answers, provenance: {}, currencyLabel: label, ...changes };
}

/** The answers without these steps. */
function without(answers: Answers, ...ids: StepId[]): Answers {
  return Object.fromEntries(Object.entries(answers).filter(([id]) => !ids.includes(id as StepId)));
}

function block(model: CanvasModel, id: string): CanvasBlock {
  const found = model.blocks.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`no block ${id}`);
  return found;
}

describe('the canvas map (D-231)', () => {
  const sourcesOf = (kind: 'business_model' | 'lean') =>
    Object.fromEntries(
      CANVAS_MAP[kind].map((definition) => [
        definition.id,
        definition.sources.map((source) => source.id),
      ]),
    );

  it('feeds the Business Model Canvas as D-231 lists', () => {
    expect(sourcesOf('business_model')).toEqual({
      customerSegments: ['C1', 'C2', 'B3'],
      valuePropositions: ['B1', 'B2', 'D5', 'C3'],
      channels: ['C7', 'E1', 'D1'],
      customerRelationships: ['C7.1'],
      revenueStreams: ['F1', 'F2', 'F7'],
      keyResources: ['E3', 'A3', 'E6'],
      keyActivities: ['E2', 'E1'],
      keyPartners: ['E5', 'E4', 'A4'],
      costStructure: ['F3', 'F4', 'F4.1', 'F5', 'E8'],
    });
  });

  it('feeds the Lean Canvas as D-231 lists', () => {
    expect(sourcesOf('lean')).toEqual({
      customerSegments: ['C2', 'B3'],
      problem: ['B2', 'B4', 'D3'],
      uniqueValueProposition: ['B1', 'D5'],
      solution: ['B1', 'E1'],
      channels: ['C7', 'D1'],
      revenueStreams: ['F1', 'F2', 'F7'],
      costStructure: ['F3', 'F4', 'F4.1', 'F5', 'E8'],
      keyMetrics: ['H2', 'H1'],
      unfairAdvantage: ['B8'],
    });
  });

  it('has nine distinct blocks on each canvas, the customer first', () => {
    for (const definitions of Object.values(CANVAS_MAP)) {
      expect(definitions).toHaveLength(9);
      expect(new Set(definitions.map((definition) => definition.id)).size).toBe(9);
      expect(definitions[0]?.id).toBe('customerSegments');
    }
  });

  it('marks as a list exactly the sources whose answer is a list', () => {
    const listKinds = ['cost_items', 'people', 'competitors', 'three_texts', 'staff_plan'];
    for (const definitions of Object.values(CANVAS_MAP)) {
      for (const source of definitions.flatMap((definition) => definition.sources)) {
        expect(source.items === true, source.id).toBe(
          listKinds.includes(fieldOfStep(source.id).kind),
        );
      }
    }
  });
});

describe('a canvas built from complete answers', () => {
  const answers = fullAnswers();

  it.each([
    ['business_model', buildBusinessModelCanvas],
    ['lean', buildLeanCanvas],
  ] as const)('gives the %s canvas a chip for every source of every block', (kind, build) => {
    const model = build(inputOf(answers));
    expect(model.kind).toBe(kind);
    expect(model.blocks.map((entry) => entry.id)).toEqual(
      CANVAS_MAP[kind].map((entry) => entry.id),
    );
    for (const definition of CANVAS_MAP[kind]) {
      const shown = block(model, definition.id);
      expect(shown.reason, definition.id).toBeNull();
      expect(shown.gaps, definition.id).toEqual([]);
      expect(new Set(shown.chips.map((chip) => chip.questionId)), definition.id).toEqual(
        new Set(definition.sources.map((source) => source.id)),
      );
    }
  });

  it('shows the founder’s own words and options in the page language', () => {
    const arabic = buildBusinessModelCanvas(inputOf(answers));
    const english = buildBusinessModelCanvas(inputOf(answers, { language: 'en' }));
    const chip = (model: CanvasModel, id: string, question: StepId) =>
      block(model, id).chips.find((entry) => entry.questionId === question);

    const idea = answers.B1;
    expect(idea?.status === 'answered' ? idea.value : null).toBe('50 مطعمًا صغيرًا في وسط إربد');
    expect(chip(arabic, 'valuePropositions', 'B1')?.text).toBe('50 مطعمًا صغيرًا في وسط إربد');
    // C1 is a single choice: its label, not its stored value.
    expect(chip(arabic, 'customerSegments', 'C1')?.text).toBe('أفراد');
    expect(chip(english, 'customerSegments', 'C1')?.text).toBe('Individuals (B2C)');
    expect(chip(english, 'channels', 'C7')?.text).toBe('Social media');
    expect(chip(arabic, 'channels', 'C7')?.text).toBe('وسائل التواصل الاجتماعي');
  });

  it('keeps the follow-up C7.1 on Customer Relationships', () => {
    const relationships = block(
      buildBusinessModelCanvas(inputOf(answers)),
      'customerRelationships',
    );
    expect(relationships.chips).toEqual([
      {
        key: 'C7.1',
        questionId: 'C7.1',
        label: null,
        text: 'متابعة بعد أسبوع من التسليم',
        provenance: ASSUMED,
      },
    ]);
  });
});

describe('chips of list answers', () => {
  it('make one chip for each cost item, with the currency after the number', () => {
    const model = buildBusinessModelCanvas(
      inputOf(
        fullAnswers({
          F3: answered({
            items: [
              { label: 'قطع غيار', amount: 8, currency: 'JOD' },
              { label: 'نقل', amount: 1.5, currency: 'JOD' },
            ],
          }),
        }),
      ),
    );
    const chips = block(model, 'costStructure').chips.filter((chip) => chip.questionId === 'F3');
    expect(chips.map(({ key, label: item, text }) => ({ key, item, text }))).toEqual([
      { key: 'F3:0', item: 'قطع غيار', text: '8 د.أ' },
      { key: 'F3:1', item: 'نقل', text: '1.5 د.أ' },
    ]);
  });

  it('write amounts in the language of the page', () => {
    const model = buildLeanCanvas(
      inputOf(fullAnswers({ F1: answered({ amount: 25.5, currency: 'JOD' }) }), {
        language: 'en',
        currencyLabel: labelEn,
      }),
    );
    expect(block(model, 'revenueStreams').chips[0]?.text).toBe('25.5 JOD');
  });

  it('make a chip for each staff role, supplier, competitor and activity', () => {
    const model = buildBusinessModelCanvas(
      inputOf(
        fullAnswers({
          E8: answered({
            items: [{ role: 'فنّي', monthlyCost: { amount: 400, currency: 'JOD' }, startMonth: 3 }],
          }),
          E4: answered({
            items: [{ name: 'مورّد قطع', detail: 'قطع المكيّفات' }, { name: 'مورّد بديل' }],
          }),
          E2: answered({ items: ['شراء القطع', 'جدولة الزيارات', 'الاستجابة السريعة'] }),
        }),
      ),
    );
    const costs = block(model, 'costStructure').chips.filter((chip) => chip.questionId === 'E8');
    expect(costs).toMatchObject([{ key: 'E8:0', label: 'فنّي', text: '400 د.أ' }]);

    const partners = block(model, 'keyPartners').chips.filter((chip) => chip.questionId === 'E4');
    expect(partners).toMatchObject([
      { key: 'E4:0', label: 'مورّد قطع', text: 'قطع المكيّفات' },
      { key: 'E4:1', label: null, text: 'مورّد بديل' },
    ]);

    const activities = block(model, 'keyActivities').chips.filter(
      (chip) => chip.questionId === 'E2',
    );
    expect(activities.map((chip) => chip.text)).toEqual([
      'شراء القطع',
      'جدولة الزيارات',
      'الاستجابة السريعة',
    ]);

    const alternatives = block(buildLeanCanvas(inputOf(fullAnswers())), 'problem').chips.filter(
      (chip) => chip.questionId === 'D3',
    );
    expect(alternatives.map((chip) => chip.key)).toEqual(['D3:0', 'D3:1', 'D3:2']);
    expect(alternatives.map((chip) => chip.text)).toEqual([
      'فنّي مستقل',
      'شركة صيانة كبيرة',
      'وكيل المكيّفات',
    ]);
  });

  it('leave out the parts the founder left blank', () => {
    const model = buildBusinessModelCanvas(
      inputOf(
        fullAnswers({
          E4: answered({
            items: [
              { name: ' ', detail: ' ' },
              { name: 'مورّد', detail: ' ' },
            ],
          }),
          F3: answered({ items: [{ label: ' ', amount: 3, currency: 'JOD' }] }),
        }),
      ),
    );
    expect(
      block(model, 'keyPartners').chips.filter((chip) => chip.questionId === 'E4'),
    ).toMatchObject([{ key: 'E4:0', label: null, text: 'مورّد' }]);
    expect(
      block(model, 'costStructure').chips.filter((chip) => chip.questionId === 'F3'),
    ).toMatchObject([{ label: null, text: '3 د.أ' }]);
  });
});

describe('chips of choices and profiles', () => {
  it('join several choices and the founder’s “other”', () => {
    const answers = fullAnswers({ C7: answered({ values: ['search', 'email'], other: 'معرض' }) });
    const arabic = block(buildLeanCanvas(inputOf(answers)), 'channels').chips[0]?.text;
    const english = block(buildLeanCanvas(inputOf(answers, { language: 'en' })), 'channels')
      .chips[0]?.text;
    expect(arabic).toBe('محرّكات البحث، البريد الإلكتروني، معرض');
    expect(english).toBe('Search engines, Email, معرض');
  });

  it('describe the first customer from the parts of the profile', () => {
    const profile = {
      occupation: 'أصحاب مطاعم',
      sector: 'I',
      size: 'micro',
      ageBand: '35_44',
      incomeBand: 'middle',
      city: 'إربد',
      decisionMaker: 'صاحب المطعم',
    };
    const english = buildLeanCanvas(
      inputOf(fullAnswers({ C2: answered(profile) }), { language: 'en' }),
    );
    expect(block(english, 'customerSegments').chips[0]?.text).toBe(
      'أصحاب مطاعم · Accommodation and food service activities · Micro (1 to 9 employees) · 35 to 44 · Middle · إربد · صاحب المطعم',
    );
    const small = buildLeanCanvas(inputOf(fullAnswers({ C2: answered({ city: 'إربد' }) })));
    expect(block(small, 'customerSegments').chips[0]?.text).toBe('إربد');
  });

  it('keeps a stored value that no option names, rather than hiding it', () => {
    const odd = buildLeanCanvas(inputOf(fullAnswers({ C2: answered({ sector: 'ZZ' }) })));
    expect(block(odd, 'customerSegments').chips[0]?.text).toBe('ZZ');
  });

  it('gives no chip for text that is only spaces', () => {
    const model = buildLeanCanvas(inputOf(fullAnswers({ B8: answered('   ') })));
    expect(block(model, 'unfairAdvantage')).toMatchObject({
      chips: [],
      gaps: [{ questionId: 'B8', state: 'empty' }],
      reason: 'empty',
    });
  });
});

describe('provenance (rule 2)', () => {
  const stored: ChipProvenance = { source: 'user', confidence: 'medium', validated: false };
  const external: ChipProvenance = { source: 'external', confidence: 'high', validated: true };

  it('is the stored provenance of the answer, on every chip it makes', () => {
    const model = buildBusinessModelCanvas(
      inputOf(fullAnswers(), { provenance: { F3: stored, B1: external } }),
    );
    const f3 = block(model, 'costStructure').chips.filter((chip) => chip.questionId === 'F3');
    expect(f3.length).toBeGreaterThan(0);
    for (const chip of f3) expect(chip.provenance).toEqual(stored);
    expect(block(model, 'valuePropositions').chips[0]?.provenance).toEqual(external);
  });

  it('is an unchecked assumption when nothing is stored', () => {
    const model = buildLeanCanvas(inputOf(fullAnswers()));
    expect(block(model, 'keyMetrics').chips[0]?.provenance).toEqual({
      source: 'assumption',
      confidence: 'low',
      validated: false,
    });
  });
});

describe('empty blocks (rule 9: never invented text)', () => {
  const lean = (answers: Answers) => buildLeanCanvas(inputOf(answers));

  it('say a source was never answered, and where to answer it', () => {
    const rest = without(fullAnswers(), 'H1', 'H2');
    const metrics = block(lean(rest), 'keyMetrics');
    expect(metrics.chips).toEqual([]);
    expect(metrics.reason).toBe('unanswered');
    expect(metrics.gaps).toEqual([
      { questionId: 'H2', state: 'unanswered' },
      { questionId: 'H1', state: 'unanswered' },
    ]);
    expect(fillingStep(metrics)).toBe('H2');
  });

  it('say a source was answered «لا أعرف», and show no chip for it', () => {
    const metrics = block(lean(fullAnswers({ H2: unknown, H1: unknown })), 'keyMetrics');
    expect(metrics).toMatchObject({ chips: [], reason: 'unknown' });
    expect(fillingStep(metrics)).toBe('H2');
  });

  it('keep the chips of the sources answered, and list the ones not', () => {
    const metrics = block(lean(fullAnswers({ H2: unknown })), 'keyMetrics');
    expect(metrics.reason).toBeNull();
    expect(metrics.chips.map((chip) => chip.questionId)).toEqual(['H1']);
    expect(metrics.gaps).toEqual([{ questionId: 'H2', state: 'unknown' }]);
  });

  it('say a list was answered with nothing in it', () => {
    const costs = block(
      buildBusinessModelCanvas(
        inputOf(
          fullAnswers({
            F3: answered({ items: [] }),
            F4: unknown,
            'F4.1': unknown,
            F5: unknown,
            E8: unknown,
          }),
        ),
      ),
      'costStructure',
    );
    expect(costs.reason).toBe('empty');
    expect(costs.gaps[0]).toEqual({ questionId: 'F3', state: 'empty' });
  });

  it('ask for C7.1 on Customer Relationships until it is answered', () => {
    const rest = without(fullAnswers(), 'C7.1');
    const relationships = block(buildBusinessModelCanvas(inputOf(rest)), 'customerRelationships');
    expect(relationships).toMatchObject({
      chips: [],
      reason: 'unanswered',
      gaps: [{ questionId: 'C7.1', state: 'unanswered' }],
    });
    const skipped = block(
      buildBusinessModelCanvas(inputOf({ ...rest, 'C7.1': unknown })),
      'customerRelationships',
    );
    expect(skipped.reason).toBe('unknown');
  });

  it('say there is no question for a block that has no source', () => {
    const [only] = buildBlocks([{ id: 'keyMetrics', sources: [] }], inputOf({}));
    expect(only).toMatchObject({ chips: [], gaps: [], reason: 'no_question' });
    expect(only && fillingStep(only)).toBeNull();
  });

  it('are all of them, for an empty project, with a reason and a link', () => {
    for (const build of [buildBusinessModelCanvas, buildLeanCanvas]) {
      for (const shown of build(inputOf({})).blocks) {
        expect(shown.chips).toEqual([]);
        expect(shown.reason).toBe('unanswered');
        expect(fillingStep(shown)).not.toBeNull();
      }
    }
  });
});

describe('the engine’s totals', () => {
  const totals = [
    { kind: 'fixedMonthly', text: '300 د.أ', provenance: ASSUMED },
    { kind: 'variableUnit', text: '8 د.أ', provenance: ASSUMED },
  ] as const;

  it('go on the cost structure of both canvases and nowhere else', () => {
    for (const build of [buildBusinessModelCanvas, buildLeanCanvas]) {
      const model = build(inputOf(fullAnswers(), { totals }));
      for (const shown of model.blocks) {
        expect(shown.totals, shown.id).toEqual(shown.id === 'costStructure' ? totals : []);
      }
    }
  });

  it('are absent when the run cannot be calculated', () => {
    expect(block(buildLeanCanvas(inputOf(fullAnswers())), 'costStructure').totals).toEqual([]);
  });
});

describe('a canvas cannot show a kind of answer it has no reading for', () => {
  it('stops, instead of showing a block that silently stays empty', () => {
    const build = () =>
      buildBlocks([{ id: 'keyMetrics', sources: [{ id: 'A2' }] }], inputOf({ A2: answered(3) }));
    expect(build).toThrow(/number answer/);
  });

  it('knows no step that is not a question or a follow-up', () => {
    expect(() => fieldOfStep('A2.7')).toThrow(/no step/);
  });
});

describe('numbers as the founder typed them', () => {
  it('drops trailing zeros after the point and groups nothing', () => {
    expect(plainNumber(1500000)).toBe('1500000');
    expect(plainNumber(12.5)).toBe('12.5');
    expect(plainNumber('1200.000')).toBe('1200');
    expect(plainNumber('12.340')).toBe('12.34');
    expect(plainNumber('-0.500')).toBe('-0.5');
    expect(plainNumber('250')).toBe('250');
  });

  it('puts the currency after the number', () => {
    const context = { language: 'ar', currencyLabel: label } as const;
    expect(amountText('250.000', 'JOD', context)).toBe('250 د.أ');
    expect(amountText(7, 'USD', context)).toBe('7 USD');
  });
});
