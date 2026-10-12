// The Business Model Canvas and the Lean Canvas as data (M5 step 3, D-231): the map from answers to
// blocks and pure builders. The page that shows them lives in apps/web. Imported as
// "@sbn/report/canvas", so the browser never loads the PDF renderer of the package's main entry.
export { buildBlocks, buildBusinessModelCanvas, buildLeanCanvas, fillingStep } from './build';
export { amountText, fieldOfStep, plainNumber } from './chips';
export { CANVAS_MAP } from './map';
export {
  ASSUMED,
  type BlockDefinition,
  type BlockId,
  type BlockSource,
  type CanvasBlock,
  type CanvasChip,
  type CanvasGap,
  type CanvasInput,
  type CanvasKind,
  type CanvasModel,
  type CanvasTotal,
  type ChipProvenance,
  type EmptyReason,
  type GapState,
} from './types';
