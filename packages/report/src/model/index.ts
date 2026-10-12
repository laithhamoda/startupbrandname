// The report as data (M5 step 5a, D-267 to D-272): the pure builder, its types and the words. Imported
// as "@sbn/report/model" by the web, so the browser never loads the PDF renderer of the package's
// main entry. The screen draws this model in step 5b; the print template does in step 6.
export { audienceOfAnswers, buildReportModel } from './build';
export { CONFIDENCE_SCORES, PRIORITY_CONFIDENCE_CEILING, VALIDATION_PLAN_DAYS } from './constants';
export { KEY_NUMBER_ORDER } from './sections/executive';
export { inlineText } from './inline';
export {
  FULL_SECTION_IDS,
  ReportModelError,
  SUMMARY_SECTION_IDS,
  type Audience,
  type Block,
  type CalloutTone,
  type CanvasCellModel,
  type Cell,
  type CellMark,
  type ChipModel,
  type Column,
  type ColumnAlign,
  type ConfidenceMeta,
  type DefinitionItem,
  type FullSectionId,
  type Inline,
  type KeyNumber,
  type LabelText,
  type LockReason,
  type Meter,
  type Part,
  type Provenance,
  type ReportInput,
  type ReportKind,
  type ReportMeta,
  type ReportModel,
  type ReportModelErrorCode,
  type Row,
  type Section,
  type SectionId,
  type SummarySectionId,
  type TableBlock,
} from './types';
export { messagesFor } from '../messages';
export type { ReportMessages } from '../messages/types';
