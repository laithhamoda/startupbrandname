import type { ReviewOutput } from '@sbn/ai';
import { type Finding, getQuestion, type QuestionId, ruleFinding } from '@sbn/question-bank';

/**
 * What the AI review found, as the findings the fixed rules produce, so the founder sees the same
 * messages whichever check fired (SPEC §2). The idea statement (B1) also gets the idea check
 * (D-072).
 */
export function aiFindings(questionId: QuestionId, review: ReviewOutput): Finding[] {
  const findings = review.violations.map((rule) => ruleFinding(questionId, rule));
  if (getQuestion(questionId).ideaCheck && review.coherent === false) {
    findings.push({ code: 'B1_unclear', severity: 'reject', questionId });
  }
  return findings;
}
