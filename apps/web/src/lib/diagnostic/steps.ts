import { findFollowUp, isQuestionId, type StepId } from '@sbn/question-bank';

// Steps travel in URLs without a dot ("F6-1" for the follow-up F6.1): the proxy skips any path
// with a dot, taking it for a file, and the session would not be refreshed.

/** The URL form of a step; also takes a step already in that form, or one not checked yet. */
export function stepSlug(step: string): string {
  return step.replace('.', '-');
}

export function stepFromSlug(slug: string): StepId | null {
  const step = slug.replace('-', '.');
  if (isQuestionId(step)) return step;
  return findFollowUp(step)?.id ?? null;
}

// Paths without the language prefix: the app's Link and router add it. Server redirects and
// revalidation, which do not, prepend `/${locale}` themselves.

export function projectPath(projectId: string): string {
  return `/projects/${projectId}`;
}

export function stepPath(projectId: string, step: StepId): string {
  return `${projectPath(projectId)}/q/${stepSlug(step)}`;
}

/** The project's canvases (M5 step 3, D-249). */
export function canvasPath(projectId: string): string {
  return `${projectPath(projectId)}/canvas`;
}

/** The value of `from` that sends a step page's founder back to the canvas after saving. */
export const CANVAS_ORIGIN = 'canvas';

/**
 * Where a canvas chip leads: the question that holds the answer, told to bring the founder back to
 * the canvas after saving (`from=canvas`, D-249). A step page without it works as before.
 */
export function stepFromCanvasPath(projectId: string, step: StepId): string {
  return `${stepPath(projectId, step)}?from=${CANVAS_ORIGIN}`;
}

/**
 * Where a follow-up the answers do not call for yet sends the founder: to its parent question. A
 * founder who came from the canvas keeps the way back (D-249), so that saving the parent returns
 * to the canvas and not to the next question.
 */
export function inactiveStepPath(projectId: string, parent: StepId, fromCanvas: boolean): string {
  return fromCanvas ? stepFromCanvasPath(projectId, parent) : stepPath(projectId, parent);
}
