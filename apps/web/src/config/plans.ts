import type { Mode } from '@sbn/question-bank';

/**
 * The packages and what each includes (D-313, D-314, D-318, D-319): one payment, no renewal. Entitlement checks
 * read this table, so no code ever branches on a package name. Prices are USD; a local-currency
 * equivalent needs a dated exchange rate and is not shown yet.
 */

export type PlanId = 'free' | 'strategist' | 'commander' | 'course';

export type Billing =
  | { kind: 'free' }
  | { kind: 'once'; days: number }
  | { kind: 'recurring'; interval: 'month' }
  | { kind: 'voucher'; months: number };

/**
 * A limit: a count for the account, a count for each project, the projects one purchase covers
 * (D-320), or unlimited.
 */
export type Quota =
  | { kind: 'none' }
  | { kind: 'count'; value: number }
  | { kind: 'perProject'; value: number }
  | { kind: 'perPurchase'; value: number }
  | { kind: 'unlimited'; fairUse: boolean };

export type Retention =
  { kind: 'days'; value: number } | { kind: 'subscriptionPlusReadOnly'; days: number };

/**
 * The report a package opens: the one-page summary, the «استراتيجي» report (the numbers: pricing,
 * break-even, projection, cash, legal path; D-314), or the full report.
 */
export type ReportLevel = 'summary' | 'standard' | 'full';

export interface Entitlements {
  projects: Quota;
  /** The deepest diagnostic the package asks: 20, 40 or 64 questions. */
  questions: Mode;
  report: ReportLevel;
  mentorMessages: Quota;
  retention: Retention;
}

export interface Plan {
  id: PlanId;
  priceUsd: number;
  billing: Billing;
  entitlements: Entitlements;
}

/**
 * Report versions of a paid project (D-321): at most `max`, and at most `afterGo` after the first
 * «امضِ». The database reads the same numbers from versions.max and versions.after_go.
 */
export const REPORT_VERSIONS = { max: 10, afterGo: 5 } as const;

/**
 * The mentor pack (D-322): more AI mentor messages for one project, bought once, on any project,
 * free ones included. It is not a package: it opens no report and no questions.
 */
export const MENTOR_PACK = { id: 'mentor_pack', priceUsd: 7, messages: 10 } as const;

/**
 * The mentor messages one project may send: its package's, plus the credits of the mentor packs
 * bought for it (D-322). Null when the package has no limit.
 */
export function mentorAllowance(entitlements: Entitlements, credits: number): number | null {
  const quota = entitlements.mentorMessages;
  switch (quota.kind) {
    case 'none':
      return credits;
    case 'unlimited':
      return null;
    default:
      return quota.value + credits;
  }
}

/** A paid package keeps its projects open for edits for 12 months (D-313). */
const PAID_DAYS = 365;
const PAID_RETENTION: Retention = { kind: 'subscriptionPlusReadOnly', days: 90 };

export const PLANS: Readonly<Record<PlanId, Plan>> = {
  free: {
    id: 'free',
    priceUsd: 0,
    billing: { kind: 'free' },
    entitlements: {
      projects: { kind: 'count', value: 1 },
      questions: 'quick',
      report: 'summary',
      mentorMessages: { kind: 'count', value: 2 },
      retention: { kind: 'days', value: 30 },
    },
  },
  strategist: {
    id: 'strategist',
    priceUsd: 10,
    billing: { kind: 'once', days: PAID_DAYS },
    entitlements: {
      projects: { kind: 'perPurchase', value: 1 },
      questions: 'standard',
      report: 'standard',
      mentorMessages: { kind: 'perProject', value: 10 },
      retention: PAID_RETENTION,
    },
  },
  commander: {
    id: 'commander',
    priceUsd: 30,
    billing: { kind: 'once', days: PAID_DAYS },
    entitlements: {
      projects: { kind: 'perPurchase', value: 1 },
      questions: 'full',
      report: 'full',
      mentorMessages: { kind: 'perProject', value: 64 },
      retention: PAID_RETENTION,
    },
  },
  // A course voucher gives «استراتيجي» on every project, for 12 months from activation (D-319).
  course: {
    id: 'course',
    priceUsd: 0,
    billing: { kind: 'voucher', months: 12 },
    entitlements: {
      projects: { kind: 'unlimited', fairUse: false },
      questions: 'standard',
      report: 'standard',
      mentorMessages: { kind: 'perProject', value: 10 },
      retention: PAID_RETENTION,
    },
  },
};

/** From the least to the most: an account with several packages gets the best one. */
export const PLAN_ORDER: readonly PlanId[] = ['free', 'strategist', 'course', 'commander'];

/** Moving up from one package to another costs the difference (D-313, D-318). */
export function upgradePrice(from: PlanId, to: PlanId): number {
  return Math.max(0, PLANS[to].priceUsd - PLANS[from].priceUsd);
}

/** Columns of the public comparison table; the course plan is shown beneath it. */
export const COMPARED_PLANS: readonly PlanId[] = ['free', 'strategist', 'commander'];
export const COURSE_PLANS: readonly PlanId[] = ['course'];

/** The column drawn with the gold rule: a business choice, changeable here (D-094). */
export const HIGHLIGHTED_PLAN: PlanId = 'commander';

/** Whether a package has a quota marked "unlimited*", which the fair-use note explains. */
export function hasFairUse(entitlements: Entitlements): boolean {
  return [entitlements.projects, entitlements.mentorMessages].some(
    (quota) => quota.kind === 'unlimited' && quota.fairUse,
  );
}

/** Lowest paid price, quoted on the home page. */
export function lowestPaidPrice(): number {
  return Math.min(
    ...Object.values(PLANS)
      .map((plan) => plan.priceUsd)
      .filter((price) => price > 0),
  );
}
