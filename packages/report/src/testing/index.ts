// Test support for the PDF renderer (D-241). Imported by tests only, never by the application:
// pdfjs-dist is a dev dependency.
export { assembleLine, foldForMatch, hasRtlLetter, type BaseDirection, type Piece } from './bidi';
export {
  inspectPdf,
  type InspectOptions,
  type InspectedPage,
  type InspectedPdf,
} from './pdf-inspect';
