import {
  GOLDEN_PROJECTS,
  runGolden,
  suggestChanges,
  type EngineRun,
  type GoldenName,
  type GoldenProject,
  type SuggestedChanges,
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

/** A small, clearly artificial pack: two Jordan items and the tax authority, one of them old. */
export function testPackItems(): readonly PackItem[] {
  const pair = (ar: string, en: string) => ({ ar, en });
  return [
    {
      countryCode: 'JO',
      key: 'registration.sole.body',
      value: {
        name: pair('تسجيل مؤسسة فردية', 'Sole proprietorship registration'),
        description: pair(
          'تُسجَّل المؤسسة لدى الجهة الرسمية.',
          'The business is registered with the official body.',
        ),
      },
      sourceUrl: 'https://example.invalid/jo/sole',
      lastVerified: '2026-10-01',
      status: 'verified',
    },
    {
      countryCode: 'JO',
      key: 'registration.company.body',
      value: {
        name: pair('تسجيل شركة', 'Company registration'),
        description: pair(
          'تُسجَّل الشركة لدى الجهة الرسمية.',
          'The company is registered with the official body.',
        ),
        note: pair('راجع الجهة الرسمية.', 'Check with the official body.'),
      },
      sourceUrl: 'https://example.invalid/jo/company',
      lastVerified: '2026-01-01',
      status: 'verified',
    },
    {
      countryCode: 'JO',
      key: 'official.tax_authority',
      value: {
        name: pair('دائرة ضريبة الدخل والمبيعات', 'Income and Sales Tax Department'),
        description: pair('الجهة الضريبية الرسمية.', 'The official tax authority.'),
        url: 'https://example.invalid/jo/tax',
      },
      sourceUrl: 'https://example.invalid/jo/tax',
      lastVerified: '2026-10-01',
      status: 'verified',
    },
  ];
}

export interface GoldenReportOptions {
  readonly locale: 'ar' | 'en';
  readonly kind?: 'full' | 'summary';
  readonly lockReason?: 'completeness' | 'plan' | null;
  readonly today?: string;
  readonly run?: EngineRun | null;
}

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
  const { answers, provenance } = goldenAnswers(name);
  const run = options.run === undefined ? runGolden(project) : options.run;
  const changes: SuggestedChanges | null = run === null ? null : suggestChanges(run, project.tax);
  const kind = options.kind ?? 'full';
  return {
    locale: options.locale,
    kind,
    lockReason: options.lockReason ?? (kind === 'full' ? null : 'plan'),
    audience: audienceOfAnswers(answers),
    project: {
      title: project.title,
      countryCode: project.context.country,
      currency: project.context.currency,
      currencyLabel: IDENTITY[name].currencyLabel,
    },
    answers,
    provenance,
    run,
    notCalculable: [],
    changes,
    packItems: testPackItems(),
    completeness: { percent: 86, gate: 'full' },
    today: options.today ?? '2026-10-12',
    inputHash: null,
  };
}
