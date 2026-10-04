import { describe, expect, it } from 'vitest';
import type { Answer } from './fields';
import {
  missingProfileParts,
  profilePartsFor,
  reviewAnswer,
  reviewNumberText,
  reviewProject,
  ruleFinding,
  stepNotes,
} from './review';
import { sampleAnswers } from './testing';
import type { QuestionId } from './types';
import type { Answers } from './values';

const answered = (value: unknown): Answer => ({ status: 'answered', value });
const codes = (id: QuestionId, value: unknown, answers: Answers = {}) =>
  reviewAnswer(id, answered(value), answers).map((finding) => finding.code);

describe('R1: the customer is "everyone"', () => {
  it.each(['الجميع', 'كل الناس', 'أيّ حدا بدو صيانة', 'ڨاع الناس', 'tout le monde', 'Everyone!'])(
    'rejects "%s" on B3',
    (text) => {
      expect(codes('B3', text)).toEqual(['R1_everyone']);
    },
  );

  it('rejects "everyone" inside the customer profile (C2)', () => {
    expect(
      codes('C2', { ageBand: '25_34', city: 'إربد', incomeBand: 'middle', occupation: 'الكل' }),
    ).toContain('R1_everyone');
  });

  it('leaves a specific answer alone, even one that uses the word in passing', () => {
    expect(codes('B3', 'أصحاب المطاعم الصغيرة في وسط إربد')).toEqual([]);
    expect(codes('B3', 'مديرو المطاعم الذين يعرف الجميع أنهم يعملون في الصيف دون تكييف')).toEqual(
      [],
    );
  });
});

describe('R2: "no competitors"', () => {
  const competitors = (name: string) => ({
    items: [name, 'b', 'c'].map((item) => ({ name: item, strength: 's', weakness: 'w' })),
  });

  it.each(['لا منافسين', 'ما في منافس', 'ماكاش منافس', 'No competitors', 'aucun concurrent'])(
    'rejects "%s" as a competitor on D3',
    (name) => {
      expect(codes('D3', competitors(name))).toEqual(['R2_no_competitors']);
    },
  );

  it('rejects "no solution today" on B4, but accepts "they put up with it"', () => {
    expect(codes('B4', 'لا يوجد حل')).toContain('R2_no_alternative');
    expect(codes('B4', 'يتحمّلون العطل ويطلبون فنّيًا من معارفهم عند الحاجة')).toEqual([]);
  });
});

describe('ruleFinding: one message per rule, whichever check found it', () => {
  it('names the rule’s message, with the alternative variant of R2 on B4', () => {
    expect(ruleFinding('B3', 'R1')).toEqual({
      code: 'R1_everyone',
      severity: 'reject',
      questionId: 'B3',
    });
    expect(ruleFinding('D3', 'R2').code).toBe('R2_no_competitors');
    expect(ruleFinding('B4', 'R2').code).toBe('R2_no_alternative');
    expect(ruleFinding('D5', 'R5').code).toBe('R5_vague');
    expect(ruleFinding('B2', 'R7').code).toBe('R7_too_short');
    expect(ruleFinding('B2', 'R8').code).toBe('R8_solution');
  });
});

describe('R3: a number that cannot be read', () => {
  it('offers the question’s ranges', () => {
    const [finding] = reviewNumberText('A6', 'حوالي عشرين ساعة');
    expect(finding).toMatchObject({ code: 'R3_not_numeric', severity: 'ask' });
    expect(finding?.ranges).toHaveLength(5);
    expect(reviewNumberText('A6', '10-20')[0]?.code).toBe('R3_range');
    expect(reviewNumberText('A6', '10 أو 12')[0]).toMatchObject({
      code: 'R3_ambiguous',
      ranges: expect.any(Array) as unknown,
    });
  });

  it('asks which reading a number with two readings has, in the founder’s words', () => {
    expect(reviewNumberText('C8', '١.٥٠٠')).toEqual([
      { code: 'R3_two_readings', severity: 'ask', questionId: 'C8', word: '١.٥٠٠' },
    ]);
  });

  it('is silent for readable numbers, empty input and non-number questions', () => {
    expect(reviewNumberText('A6', '٢٠')).toEqual([]);
    expect(reviewNumberText('A6', '')).toEqual([]);
    expect(reviewNumberText('B3', 'كلام')).toEqual([]);
  });
});

describe('R4: "I don’t know" typed as text', () => {
  it.each(['لا أعرف', 'ما بعرف', 'ما نعرفش', 'je sais pas', "I don't know"])(
    'offers to save "%s" as unknown',
    (text) => {
      expect(reviewAnswer('B4', answered(text))).toEqual([
        { code: 'R4_unknown_text', severity: 'ask', questionId: 'B4' },
      ]);
    },
  );

  it('does not offer it where «لا أعرف» is not allowed', () => {
    expect(codes('B1', 'لا أعرف')).not.toContain('R4_unknown_text');
  });

  it('never rejects a stored «لا أعرف» (D-104)', () => {
    expect(reviewAnswer('F1', { status: 'unknown' })).toEqual([]);
  });
});

describe('R5: vague adjectives without a number', () => {
  it.each(['خدمة أفضل وأسرع', 'جودة عالية', 'better and faster', 'moins cher'])(
    'rejects "%s" on D5',
    (text) => {
      expect(codes('D5', `${text} من كل المنافسين في المدينة`)).toContain('R5_vague');
    },
  );

  it('accepts the same words once a number backs them', () => {
    expect(codes('D5', 'أسرع بيومين من أقرب فنّي، وأرخص بـ 15 دينارًا للزيارة')).toEqual([]);
  });

  it('also applies to the 12-month goal (H1)', () => {
    expect(codes('H1', 'أن أكون الأفضل')).toEqual(['R5_vague']);
  });
});

describe('R7: too short for a long answer', () => {
  it('asks for a real example', () => {
    expect(codes('B2', 'الأعطال')).toContain('R7_too_short');
    expect(codes('E1', 'يطلب ثم أزوره')).toEqual(['R7_too_short']);
  });
});

describe('R8: a solution instead of a problem (B2)', () => {
  it.each([
    'تطبيق يربط المطاعم بفنّيي الصيانة بشكل سريع ومنظم',
    'منصة لحجز الصيانة الدورية للمكيّفات في إربد',
    'An app that connects restaurants with technicians quickly',
    'Une application pour réserver la maintenance des climatiseurs',
  ])('rejects "%s"', (text) => {
    expect(codes('B2', text)).toContain('R8_solution');
  });

  it('accepts a problem, even one that mentions an app', () => {
    expect(
      codes('B2', 'المطاعم تخسر يومين من المبيعات حين يتعطّل المكيّف، ولا تجد فنّيًا سريعًا'),
    ).toEqual([]);
    expect(
      codes('B2', 'تطبيقات الحجز الحالية صعبة، فيضيع صاحب المطعم يومًا كاملًا في البحث عن فنّي'),
    ).toEqual([]);
  });
});

describe('question-specific checks (SPEC §1, Logic column)', () => {
  it('A3: "everything" is not a skill', () => {
    expect(codes('A3', { values: [], other: 'كل شيء' })).toEqual(['A3_everything']);
    expect(codes('A3', { values: ['sales'], other: 'الطبخ' })).toEqual([]);
    expect(codes('A3', { values: ['sales'] })).toEqual([]);
  });

  it('A6: fewer than 10 hours a week is a timeline warning', () => {
    expect(reviewAnswer('A6', answered(6))).toEqual([
      { code: 'A6_low_hours', severity: 'warn', questionId: 'A6' },
    ]);
    expect(codes('A6', 10)).toEqual([]);
  });

  it('B1: at most 40 words, in one sentence', () => {
    expect(codes('B1', Array.from({ length: 41 }, () => 'كلمة').join(' '))).toEqual([
      'B1_too_long',
    ]);
    expect(codes('B1', 'صيانة للمطاعم. وأيضًا للفنادق.')).toEqual(['B1_one_sentence']);
    expect(
      codes('B1', 'صيانة دورية لمكيّفات المطاعم الصغيرة في إربد لأن الأعطال توقف المطبخ.'),
    ).toEqual([]);
  });

  it('B5: no interviews marks the problem untested', () => {
    expect(codes('B5', 0)).toEqual(['B5_untested']);
    expect(codes('B5', 3)).toEqual([]);
  });

  it('B8: "nobody can copy it" is not a barrier', () => {
    expect(codes('B8', 'لا أحد يستطيع')).toEqual(['B8_nobody']);
    expect(codes('B8', 'عقد حصري مع وكيل قطع الغيار الوحيد في المدينة')).toEqual([]);
  });

  it('C2: the profile must fit the payer in C1', () => {
    const individual = {
      ageBand: '25_34',
      city: 'إربد',
      incomeBand: 'middle',
      occupation: 'موظفات',
    };
    const organisation = { sector: 'I', size: 'micro', decisionMaker: 'صاحب المطعم' };
    const withPayer = (payer: string) => ({ C1: answered(payer) });

    expect(codes('C2', individual, withPayer('b2c'))).toEqual([]);
    expect(reviewAnswer('C2', answered(organisation), withPayer('b2c'))[0]).toMatchObject({
      code: 'C2_incomplete',
      missing: ['ageBand', 'city', 'incomeBand', 'occupation'],
    });
    expect(codes('C2', organisation, withPayer('b2g'))).toEqual([]);
    expect(codes('C2', individual, withPayer('mixed'))).toEqual([]);
    expect(codes('C2', individual, {})).toEqual([]);
  });

  it('C2: shows and asks for the parts that fit the payer (one split for the editor and the check)', () => {
    const individual = ['ageBand', 'city', 'incomeBand', 'occupation'];
    const organisation = ['sector', 'size', 'decisionMaker'];
    expect(profilePartsFor('b2c')).toEqual({ individual, organisation: [] });
    expect(profilePartsFor('b2b')).toEqual({ individual: [], organisation });
    expect(profilePartsFor('b2g')).toEqual({ individual: [], organisation });
    expect(profilePartsFor('mixed')).toEqual({ individual, organisation });
    expect(profilePartsFor(undefined)).toEqual({ individual, organisation });
    expect(missingProfileParts({}, undefined)).toEqual([]);
    expect(missingProfileParts({ sector: 'I' }, 'b2b')).toEqual(['size', 'decisionMaker']);
  });

  it('C2 (mixed payer): asks for the kind that is closer to complete', () => {
    expect(
      missingProfileParts(
        { ageBand: '25_34', city: 'إربد', incomeBand: 'middle', sector: 'I' },
        'mixed',
      ),
    ).toEqual(['occupation']);
    expect(missingProfileParts({ ageBand: '25_34', sector: 'I', size: 'micro' }, 'mixed')).toEqual([
      'decisionMaker',
    ]);
  });

  it('D1, E4, G6: warnings that keep the answer', () => {
    expect(codes('D1', 'multi_country')).toEqual(['D1_focus']);
    expect(codes('E4', { items: [{ name: 'واحد' }] })).toEqual(['E4_single_supplier']);
    expect(codes('G6', false)).toEqual(['G6_later_path']);
    expect(codes('G6', true)).toEqual([]);
  });

  it('F4: fixed costs cannot all be zero', () => {
    expect(codes('F4', { items: [{ label: 'إيجار', amount: 0, currency: 'JOD' }] })).toEqual([
      'F4_zero',
    ]);
    expect(codes('F4', { items: [{ label: 'إيجار', amount: 150, currency: 'JOD' }] })).toEqual([]);
  });

  it('H1: a goal needs a number', () => {
    expect(codes('H1', 'أن ينجح المشروع')).toEqual(['H1_not_measurable']);
    expect(codes('H1', '50 مطعمًا بعقد صيانة شهري')).toEqual([]);
  });

  it('never fires on the neutral sample answers', () => {
    const answers = sampleAnswers();
    for (const [id, answer] of Object.entries(answers)) {
      if (answer) expect(reviewAnswer(id as QuestionId, answer, answers), id).toEqual([]);
    }
    expect(reviewProject(answers)).toEqual([]);
  });
});

describe('across answers', () => {
  const base = sampleAnswers();
  const project = (changes: Answers) =>
    reviewProject({ ...base, ...changes }).map((finding) => finding.code);

  it('blocks when the variable cost reaches the price (F3 ≥ F1)', () => {
    expect(
      project({ F3: answered({ items: [{ label: 'قطع', amount: 25, currency: 'JOD' }] }) }),
    ).toEqual(['F3_exceeds_price']);
  });

  it('does not compare amounts in different currencies (#21)', () => {
    expect(
      project({ F3: answered({ items: [{ label: 'قطع', amount: 99, currency: 'USD' }] }) }),
    ).toEqual([]);
  });

  it('flags set-up costs above the available capital (F5 > A5)', () => {
    const findings = reviewProject({
      ...base,
      F5: answered({ items: [{ label: 'معدات', amount: 6000, currency: 'JOD' }] }),
    });
    expect(findings).toEqual([
      { code: 'F5_exceeds_capital', severity: 'warn', questionId: 'F5', related: ['A5', 'H3'] },
    ]);
  });

  it('R6: shows contradicting answers side by side', () => {
    expect(project({ B5: answered(0), C6: answered('promised') })).toEqual([
      'R6_interviews_vs_payment',
    ]);
    expect(
      project({ F6: answered({ month1: 20, month6: 30, month12: 40 }), E7: answered(10) }),
    ).toEqual(['R6_sales_vs_capacity']);
    expect(
      project({
        A4: answered({ items: [] }),
        G4: answered({
          items: [
            { label: 'أ', percent: 50 },
            { label: 'ب', percent: 50 },
          ],
        }),
      }),
    ).toEqual(['R6_team_vs_ownership']);
    expect(project({ A7: answered('lt3'), H5: answered('m12') })).toEqual([
      'R6_breakeven_vs_runway',
    ]);
    expect(project({ A7: answered('6to12'), H5: answered('m12') })).toEqual([]);
  });

  it('warns when partners have no written agreement (G4.1)', () => {
    expect(project({ 'G4.1': answered(false) })).toEqual(['G4_no_agreement']);
    expect(project({ 'G4.1': answered(true) })).toEqual([]);
  });
});

describe('stepNotes: the warnings shown with a saved answer (ARCH-6)', () => {
  const base = sampleAnswers();
  const partners = answered({
    items: [
      { label: 'أ', percent: 50 },
      { label: 'ب', percent: 50 },
    ],
  });

  it('lists a question’s own warnings and the cross-answer ones it is part of', () => {
    const answers = { ...base, A6: answered(6), A7: answered('lt3'), H5: answered('m12') };
    expect(stepNotes('A6', answers).map((finding) => finding.code)).toEqual(['A6_low_hours']);
    expect(stepNotes('H5', answers).map((finding) => finding.code)).toEqual([
      'R6_breakeven_vs_runway',
    ]);
    expect(stepNotes('A7', answers).map((finding) => finding.code)).toEqual([
      'R6_breakeven_vs_runway',
    ]);
  });

  it('keeps a follow-up’s warning on a later visit (G4.1 without an agreement)', () => {
    const answers = { ...base, G4: partners, 'G4.1': answered(false) };
    expect(stepNotes('G4.1', answers).map((finding) => finding.code)).toEqual(['G4_no_agreement']);
    expect(stepNotes('G4.1', { ...answers, 'G4.1': answered(true) })).toEqual([]);
  });

  it('says nothing about a step without an answer, or about blocking rules', () => {
    expect(stepNotes('F1', {})).toEqual([]);
    expect(stepNotes('B3', { B3: answered('الجميع') })).toEqual([]);
  });
});
