import { FOLLOW_UPS, isQuestionId, type StepId } from '@sbn/question-bank';

// Steps travel in URLs without a dot ("F6-1" for the follow-up F6.1): the proxy skips any path
// with a dot, taking it for a file, and the session would not be refreshed.

export function stepSlug(step: StepId): string {
  return step.replace('.', '-');
}

export function stepFromSlug(slug: string): StepId | null {
  const step = slug.replace('-', '.');
  if (isQuestionId(step)) return step;
  return FOLLOW_UPS.some((followUp) => followUp.id === step) ? (step as StepId) : null;
}

export function isFollowUpStep(step: StepId): boolean {
  return step.includes('.');
}

// Paths without the language prefix: the app's Link and router add it. Server redirects and
// revalidation, which do not, prepend `/${locale}` themselves.

export function projectPath(projectId: string): string {
  return `/projects/${projectId}`;
}

export function stepPath(projectId: string, step: StepId): string {
  return `${projectPath(projectId)}/q/${stepSlug(step)}`;
}
