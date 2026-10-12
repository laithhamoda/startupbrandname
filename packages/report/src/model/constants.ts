import type { FigureConfidence } from '@sbn/engine';

/*
 * The numbers the report's sentences name that are neither an engine figure nor an answer. A
 * message holds no digit (D-270), so each of these enters a template through a slot.
 */

/** The length of the validation plan in days (SPEC section 6, "30-day validation plan"). */
export const VALIDATION_PLAN_DAYS = 30;

/** The score the validation plan gives a confidence level (D-230): low 1, medium 2, high 3. */
export const CONFIDENCE_SCORES: Readonly<Record<FigureConfidence, number>> = {
  low: 1,
  medium: 2,
  high: 3,
};

/** The priority is (this - confidence score) x (rank ceiling - rank), where this is highest + 1 (D-230). */
export const PRIORITY_CONFIDENCE_CEILING = 4;
