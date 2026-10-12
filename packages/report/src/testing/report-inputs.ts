import {
  GOLDEN_PROJECTS,
  runEngine,
  suggestChanges,
  type EngineRunResult,
  type GoldenName,
  type GoldenProject,
  type NotCalculableReason,
  type SuggestedChanges,
  type TaxContext,
} from '@sbn/engine';
import type { Answers } from '@sbn/question-bank';
import type { PackItem } from '../legal-path';
import { audienceOfAnswers } from '../model/build';
import type { ReportInput } from '../model/types';

/*
 * Report inputs for the tests (M5 step 5a, D-272): the three golden projects of the engine, each
 * with the identity answers a real diagnostic would hold, and a small country pack. Imported by
 * tests only, never by the application.
 */

const real = (value: unknown) => ({ status: 'answered' as const, value });
const userHigh = { source: 'user', confidence: 'high', validated: true } as const;

/** What a founder says about the project besides the numbers: who, what, for whom, where, goal. */
const IDENTITY: Readonly<
  Record<GoldenName, { readonly answers: Answers; readonly currencyLabel: string }>
> = {
  'jo-service-subscription': {
    currencyLabel: 'د.أ',
    answers: {
      A1: real({ country: 'JO', city: 'عمّان' }),
      A4: real({ items: [{ name: 'سامر', detail: 'شريك مؤسس' }] }),
      A8: real('scalable_company'),
      B1: real('منصة برمجية تدير حجوزات العيادات الصغيرة باشتراك شهري.'),
      B7: real('digital'),
      C1: real('b2b'),
      D2: real('J'),
      E6: real('office'),
      G7: real('no'),
      H8: real('investor'),
    },
  },
  'jo-home-ecommerce': {
    currencyLabel: 'د.أ',
    answers: {
      A1: real({ country: 'JO', city: 'إربد' }),
      A8: real('side_income'),
      B1: real('متجر منزلي يبيع مستلزمات المطبخ المستوردة عبر الإنترنت.'),
      B7: real('physical_product'),
      C1: real('b2c'),
      D2: real('G'),
      E6: real('home'),
      G7: real('yes'),
      H8: real('bank'),
    },
  },
  'dz-auto-entrepreneur': {
    currencyLabel: 'د.ج',
    answers: {
      A1: real({ country: 'DZ', city: 'وهران' }),
      A8: real('main_income'),
      B1: real('خدمة صيانة للأجهزة المنزلية لدى الزبائن.'),
      B7: real('service'),
      C1: real('b2c'),
      D2: real('S'),
      E6: real('field'),
      G7: real('no_preference'),
      H8: real('grant_body'),
    },
  },
};

const pair = (ar: string, en: string) => ({ ar, en });

function packItem(
  countryCode: string,
  key: string,
  name: { ar: string; en: string },
  options: {
    readonly lastVerified?: string | null;
    readonly status?: PackItem['status'];
    readonly url?: string;
    readonly note?: boolean;
    readonly figure?: string;
  } = {},
): PackItem {
  const slug = key.replace(/[^a-z]+/g, '-');
  return {
    countryCode,
    key,
    value: {
      name,
      description: pair('وصف تجريبي من مصدر رسمي.', 'A test description from an official source.'),
      ...(options.note === true ? { note: pair('ملاحظة تجريبية.', 'A test note.') } : {}),
      ...(options.url === undefined ? {} : { url: options.url }),
      ...(options.figure === undefined
        ? {}
        : {
            figures: [
              {
                id: 'ceiling',
                text: options.figure,
                evidence: [
                  {
                    text: 'a sentence of the official page',
                    lang: 'en' as const,
                    url: `https://example.invalid/${countryCode.toLowerCase()}/${slug}`,
                  },
                ],
              },
            ],
          }),
    },
    sourceUrl: `https://example.invalid/${countryCode.toLowerCase()}/${slug}`,
    lastVerified: options.lastVerified === undefined ? '2026-10-01' : options.lastVerified,
    status: options.status ?? 'verified',
  };
}

/**
 * A small, clearly artificial country pack (example.invalid links, invented descriptions): Jordan
 * with a fresh item, an old item and the tax authority link; Algeria with an item under review, a
 * ceiling figure and a tax authority item that holds no link. The real pack is in the database.
 */
export function testPackItems(): readonly PackItem[] {
  return [
    packItem(
      'JO',
      'registration.sole.body',
      pair('تسجيل مؤسسة فردية', 'Sole proprietorship registration'),
    ),
    packItem('JO', 'registration.company.body', pair('تسجيل شركة', 'Company registration'), {
      lastVerified: '2026-01-01',
      note: true,
    }),
    packItem(
      'JO',
      'registration.chamber.membership',
      pair('الانتساب إلى الغرفة', 'Chamber membership'),
    ),
    packItem('JO', 'tax.registration.body', pair('التسجيل الضريبي', 'Tax registration'), {
      lastVerified: null,
    }),
    packItem(
      'JO',
      'official.tax_authority',
      pair('دائرة ضريبة الدخل والمبيعات', 'Income and Sales Tax Department'),
      { url: 'https://example.invalid/jo/tax' },
    ),
    packItem(
      'DZ',
      'registration.auto_entrepreneur.body',
      pair('مسار المقاول الذاتي', 'The auto-entrepreneur path'),
      { status: 'under_review' },
    ),
    packItem(
      'DZ',
      'tax.ifu.auto_entrepreneur.rate_ceiling',
      pair('سقف الضريبة الجزافية الوحيدة', 'The flat-tax ceiling'),
      { figure: '5,000,000 DA' },
    ),
    packItem(
      'DZ',
      'official.tax_authority',
      pair('المديرية العامة للضرائب', 'The tax directorate'),
    ),
  ];
}

export interface GoldenReportOptions {
  readonly locale: 'ar' | 'en';
  readonly kind?: 'full' | 'summary';
  readonly lockReason?: 'completeness' | 'plan' | null;
  readonly today?: string;
  /** Changes the answers (and their provenance) before the engine runs again. */
  readonly change?: (answers: MutableAnswers, provenance: MutableProvenance) => void;
  /** The tax context of the run; the project's own fixture rules by default. */
  readonly tax?: TaxContext;
  /** Pretend the answers cannot be calculated: no run, and these reasons. */
  readonly withoutRun?: readonly NotCalculableReason[];
}

export type MutableAnswers = Record<string, unknown>;
export type MutableProvenance = Record<string, unknown>;

/** Removes answers (or their provenance) by question ID, for a test that trims a project. */
export function drop(target: Record<string, unknown>, ...ids: readonly string[]): void {
  for (const id of ids) Reflect.deleteProperty(target, id);
}

/** An answered question, the way the database holds it. */
export const answered = (value: unknown) => ({ status: 'answered' as const, value });

export function goldenProject(name: GoldenName): GoldenProject {
  const found = GOLDEN_PROJECTS.find((candidate) => candidate.name === name);
  if (found === undefined) throw new Error(`no golden project ${name}`);
  return found;
}

/** The answers of a golden project together with its identity answers, and their provenance. */
export function goldenAnswers(name: GoldenName): {
  readonly answers: Answers;
  readonly provenance: GoldenProject['provenance'];
} {
  const project = goldenProject(name);
  const identity = IDENTITY[name].answers;
  const provenance = { ...project.provenance };
  for (const id of Object.keys(identity)) {
    Object.assign(provenance, { [id]: userHigh });
  }
  return { answers: { ...project.answers, ...identity }, provenance };
}

export function goldenReportInput(name: GoldenName, options: GoldenReportOptions): ReportInput {
  const project = goldenProject(name);
  const base = goldenAnswers(name);
  const answers: MutableAnswers = { ...base.answers };
  const provenance: MutableProvenance = { ...base.provenance };
  options.change?.(answers, provenance);
  const tax = options.tax ?? project.tax;
  const result: EngineRunResult = runEngine(
    answers as Answers,
    provenance as GoldenProject['provenance'],
    project.context,
    tax,
  );
  const calculated = options.withoutRun === undefined && result.status === 'ok';
  const run = calculated ? result.run : null;
  const changes: SuggestedChanges | null = run === null ? null : suggestChanges(run, tax);
  const kind = options.kind ?? 'full';
  return {
    locale: options.locale,
    kind,
    lockReason: options.lockReason ?? (kind === 'full' ? null : 'plan'),
    audience: audienceOfAnswers(answers as Answers),
    project: {
      title: project.title,
      countryCode: project.context.country,
      currency: project.context.currency,
      currencyLabel: IDENTITY[name].currencyLabel,
    },
    answers: answers as Answers,
    provenance: provenance as GoldenProject['provenance'],
    run,
    notCalculable: options.withoutRun ?? (result.status === 'not_calculable' ? result.reasons : []),
    changes,
    packItems: testPackItems(),
    completeness: { percent: 86, gate: 'full' },
    today: options.today ?? '2026-10-12',
    inputHash: null,
  };
}
