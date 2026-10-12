import type { BlockDefinition, BlockSource, CanvasKind } from './types';

const answer = (id: BlockSource['id']): BlockSource => ({ id });
const list = (id: BlockSource['id']): BlockSource => ({ id, items: true });

/** The cost structure is the same on both canvases (D-231). */
const COST_STRUCTURE: BlockDefinition = {
  id: 'costStructure',
  sources: [list('F3'), list('F4'), answer('F4.1'), list('F5'), list('E8')],
};

/** The revenue streams are the same on both canvases (D-231). */
const REVENUE_STREAMS: BlockDefinition = {
  id: 'revenueStreams',
  sources: [answer('F1'), answer('F2'), answer('F7')],
};

/**
 * Which answers feed which block (D-231): the one place that says so. A block shows one chip for
 * each source answer, or for each line of a list source; a source without an answer gives an
 * empty-state reason and a link to its question, never invented text (CLAUDE.md rule 9). Each
 * canvas lists its blocks in filling order, customer first, which is also the order they stack in
 * on a phone; where a block sits on the board is the page's business (D-051, D-250).
 */
export const CANVAS_MAP: Readonly<Record<CanvasKind, readonly BlockDefinition[]>> = {
  business_model: [
    { id: 'customerSegments', sources: [answer('C1'), answer('C2'), answer('B3')] },
    {
      id: 'valuePropositions',
      sources: [answer('B1'), answer('B2'), answer('D5'), answer('C3')],
    },
    { id: 'channels', sources: [answer('C7'), answer('E1'), answer('D1')] },
    { id: 'customerRelationships', sources: [answer('C7.1')] },
    REVENUE_STREAMS,
    { id: 'keyResources', sources: [list('E3'), answer('A3'), answer('E6')] },
    { id: 'keyActivities', sources: [list('E2'), answer('E1')] },
    { id: 'keyPartners', sources: [answer('E5'), list('E4'), list('A4')] },
    COST_STRUCTURE,
  ],
  lean: [
    { id: 'customerSegments', sources: [answer('C2'), answer('B3')] },
    // Existing alternatives (D3) belong to the problem, as the Lean Canvas names it.
    { id: 'problem', sources: [answer('B2'), answer('B4'), list('D3')] },
    { id: 'uniqueValueProposition', sources: [answer('B1'), answer('D5')] },
    { id: 'solution', sources: [answer('B1'), answer('E1')] },
    { id: 'channels', sources: [answer('C7'), answer('D1')] },
    REVENUE_STREAMS,
    COST_STRUCTURE,
    { id: 'keyMetrics', sources: [answer('H2'), answer('H1')] },
    { id: 'unfairAdvantage', sources: [answer('B8')] },
  ],
};
