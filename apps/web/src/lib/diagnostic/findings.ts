import {
  type Finding,
  getQuestion,
  type Language,
  message,
  type NumberRange,
  PROFILE_PARTS,
  type QuestionId,
  type Severity,
} from '@sbn/question-bank';

/** A finding ready to show: the message in the page language and the answers it involves. */
export interface FindingView {
  code: string;
  severity: Severity;
  text: string;
  related: { id: QuestionId; label: string }[];
  ranges?: readonly NumberRange[];
}

export function viewFinding(finding: Finding, language: Language): FindingView {
  const word = finding.missing
    ? finding.missing
        .map((part) => PROFILE_PARTS[part][language])
        .join(language === 'ar' ? '، ' : ', ')
    : finding.word;
  return {
    code: finding.code,
    severity: finding.severity,
    text: message(finding.code, language, word),
    related: (finding.related ?? []).map((id) => ({ id, label: getQuestion(id).label[language] })),
    ...(finding.ranges ? { ranges: finding.ranges } : {}),
  };
}
