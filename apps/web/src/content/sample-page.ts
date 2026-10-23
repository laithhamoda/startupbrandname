import 'server-only';
import type { Localized } from './types';

export interface SamplePageContent {
  heading: string;
  lead: string;
  /** What the sample is and is not, said before the report. */
  notice: string;
  /** Why the legal path and the tax notices are not in the sample (they follow the country's data). */
  omitted: string;
  start: string;
  plans: string;
}

/** The words around the sample report (D-293); the report itself is the frozen model in sample-report/. */
export const SAMPLE_PAGE: Localized<SamplePageContent> = {
  ar: {
    heading: 'تقرير نموذجي',
    lead: 'هذا ما تحصل عليه حين تُكمل تشخيص مشروعك: تقرير كامل بحكم واضح، وأرقام يحسبها المحرك بمعادلات ثابتة ويحمل كل رقم منها مصدره ومستوى ثقته.',
    notice:
      'عيّنة توضيحية لمشروع افتراضي: خدمة برمجية بالاشتراك الشهري في عمّان. أرقامه وأسماؤه كلها مُدخَلة لأجل العيّنة، وليست بيانات عن سوق حقيقي ولا توصية بقرار.',
    omitted:
      'لا يظهر في العيّنة المسار القانوني ولا الضريبة: يُبنيان في تقريرك من بيانات بلدك الموثّقة بمصادرها وتاريخها، ولا نثبّتها في صفحة تتقادم. وحين لا تتوفر هذه البيانات لبلدك يقول تقريرك ذلك صراحة ولا يضع رقمًا من عنده.',
    start: 'ابدأ تشخيص مشروعك مجانًا',
    plans: 'اطّلع على الخطط',
  },
  en: {
    heading: 'Sample report',
    lead: 'This is what you get when you finish the diagnostic of your project: a full report with a clear verdict and numbers that the engine calculates with fixed formulas, each carrying its source and its confidence.',
    notice:
      'An illustrative sample for a fictional project: a monthly software subscription in Amman. All its figures and names are made up for the sample: they are not data about a real market and not a recommendation.',
    omitted:
      'The sample leaves out the legal path and the tax notices: your report builds them from your country’s data, verified against its sources and dated, and we do not freeze them in a page that goes stale. When that data does not exist for your country, your report says so plainly and puts in no number of its own.',
    start: 'Start your diagnostic for free',
    plans: 'See the plans and prices',
  },
};
