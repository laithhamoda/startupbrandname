import type { ReviewOutput } from '@sbn/ai';
import type { Finding, QuestionId } from '@sbn/question-bank';

/**
 * What the AI review found, as the findings the fixed rules produce, so the founder sees the same
 * messages whichever check fired (SPEC §2). B1 also gets the idea check (D-072).
 */
export function aiFindings(questionId: QuestionId, review: ReviewOutput): Finding[] {
  const codes = {
    R1: 'R1_everyone',
    R2: questionId === 'B4' ? 'R2_no_alternative' : 'R2_no_competitors',
    R5: 'R5_vague',
    R8: 'R8_solution',
  } as const;
  const findings: Finding[] = review.violations.map((rule) => ({
    code: codes[rule],
    severity: 'reject',
    questionId,
  }));
  if (questionId === 'B1' && review.coherent === false) {
    findings.push({ code: 'B1_unclear', severity: 'reject', questionId });
  }
  return findings;
}
