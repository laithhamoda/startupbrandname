import type { ReviewOutput } from '@sbn/ai';
import { describe, expect, it } from 'vitest';
import { aiFindings } from './findings';

const review = (changes: Partial<ReviewOutput>): ReviewOutput => ({
  language: 'msa',
  msa: 'نص',
  confirmation: '',
  violations: [],
  coherent: null,
  ...changes,
});

describe('aiFindings', () => {
  it('turns each rule the model flagged into the rule message', () => {
    expect(aiFindings('C1', review({ violations: ['R1', 'R5'] })).map((f) => f.code)).toEqual([
      'R1_everyone',
      'R5_vague',
    ]);
    expect(aiFindings('B2', review({ violations: ['R8'] }))[0]).toEqual({
      code: 'R8_solution',
      severity: 'reject',
      questionId: 'B2',
    });
  });

  it('asks about the alternative on B4 and about competitors elsewhere (R2)', () => {
    expect(aiFindings('B4', review({ violations: ['R2'] }))[0]?.code).toBe('R2_no_alternative');
    expect(aiFindings('E1', review({ violations: ['R2'] }))[0]?.code).toBe('R2_no_competitors');
  });

  it('sends back an unclear idea on B1 only (D-072)', () => {
    expect(aiFindings('B1', review({ coherent: false })).map((f) => f.code)).toEqual([
      'B1_unclear',
    ]);
    expect(aiFindings('B1', review({ coherent: true }))).toEqual([]);
    expect(aiFindings('B2', review({ coherent: false }))).toEqual([]);
  });
});
