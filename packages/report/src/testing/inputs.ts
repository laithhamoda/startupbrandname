// The report inputs of the three golden projects, for the design gallery of the web (M5 step 5b,
// D-276). A separate entry point so that the gallery does not load the PDF inspector (and its
// dev dependency) that "@sbn/report/testing" also exports. Test support: never imported by the
// real report route.
export {
  answered,
  drop,
  goldenAnswers,
  goldenProject,
  goldenReportInput,
  testPackItems,
  type GoldenReportOptions,
} from './report-inputs';
