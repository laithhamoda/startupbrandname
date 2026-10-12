import type { StepId } from '@sbn/question-bank';
import { chipsOf } from './chips';
import { CANVAS_MAP } from './map';
import {
  ASSUMED,
  type BlockDefinition,
  type CanvasBlock,
  type CanvasChip,
  type CanvasGap,
  type CanvasInput,
  type CanvasKind,
  type CanvasModel,
  type ChipProvenance,
  type EmptyReason,
} from './types';

/**
 * The provenance of an answered question: what the row stored, and an unchecked assumption when
 * nothing is stored (rule 2). «لا أعرف» never gets here: it gives no chip (rule 9).
 */
function provenanceFor(stored: ChipProvenance | undefined): ChipProvenance {
  return stored ?? ASSUMED;
}

/**
 * One block from its sources. The first source that gave no chip decides the reason and the link
 * of an empty block, so the founder is sent to the first question that would fill it.
 */
function buildBlock(definition: BlockDefinition, input: CanvasInput): CanvasBlock {
  const chips: CanvasChip[] = [];
  const gaps: CanvasGap[] = [];
  for (const source of definition.sources) {
    const answer = input.answers[source.id];
    if (!answer) {
      gaps.push({ questionId: source.id, state: 'unanswered' });
      continue;
    }
    if (answer.status === 'unknown') {
      gaps.push({ questionId: source.id, state: 'unknown' });
      continue;
    }
    const made = chipsOf(
      source.id,
      answer.value,
      source.items === true,
      provenanceFor(input.provenance[source.id]),
      input,
    );
    if (made.length === 0) gaps.push({ questionId: source.id, state: 'empty' });
    chips.push(...made);
  }
  const reason: EmptyReason | null = chips.length > 0 ? null : (gaps[0]?.state ?? 'no_question');
  return {
    id: definition.id,
    chips,
    gaps,
    reason,
    totals: definition.id === 'costStructure' ? (input.totals ?? []) : [],
  };
}

/** The blocks of a map, in the map's order. Exported so a test can use a map of its own. */
export function buildBlocks(
  definitions: readonly BlockDefinition[],
  input: CanvasInput,
): readonly CanvasBlock[] {
  return definitions.map((definition) => buildBlock(definition, input));
}

function build(kind: CanvasKind, input: CanvasInput): CanvasModel {
  return { kind, blocks: buildBlocks(CANVAS_MAP[kind], input) };
}

/** The Business Model Canvas from the founder's own answers (T1, D-231). */
export function buildBusinessModelCanvas(input: CanvasInput): CanvasModel {
  return build('business_model', input);
}

/** The Lean Canvas from the founder's own answers (T2, D-231). */
export function buildLeanCanvas(input: CanvasInput): CanvasModel {
  return build('lean', input);
}

/** The step a block's empty state sends the founder to, or null when no question fills it. */
export function fillingStep(block: CanvasBlock): StepId | null {
  return block.gaps[0]?.questionId ?? null;
}
