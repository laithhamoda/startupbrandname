/**
 * Plans and what each includes, as locked in CLAUDE.md §3 (with D-071 for the mentor quota).
 * Display only until payments exist (M7); entitlement checks will read the same table, so no code
 * ever branches on a plan name. Prices are USD; a local-currency equivalent needs a dated
 * exchange rate and is not shown yet.
 */

export type PlanId = 'free' | 'weekly' | 'monthly' | 'annual' | 'course' | 'alumni';

export type Billing =
  | { kind: 'free' }
  | { kind: 'once'; days: number }
  | { kind: 'recurring'; interval: 'month' }
  | { kind: 'voucher'; months: number };

/** A limit: a count, a count per period, or unlimited (fair use applies where marked). */
export type Quota =
  | { kind: 'none' }
  | { kind: 'count'; value: number }
  | { kind: 'perDay'; value: number }
  | { kind: 'unlimited'; fairUse: boolean };

export type Retention =
  { kind: 'days'; value: number } | { kind: 'subscriptionPlusReadOnly'; days: number };

export interface Entitlements {
  projects: Quota;
  onePageSummary: boolean;
  fullReport: Quota;
  mentorMessages: Quota;
  /** v2 features: shown as "coming soon" until they ship. */
  competitorEnrichment: boolean;
  pitchDeck: boolean;
  quarterlyRefresh: boolean;
  retention: Retention;
}

export interface Plan {
  id: PlanId;
  priceUsd: number;
  billing: Billing;
  entitlements: Entitlements;
}

const UNLIMITED: Quota = { kind: 'unlimited', fairUse: false };
const FAIR_USE: Quota = { kind: 'unlimited', fairUse: true };
const PAID_RETENTION: Retention = { kind: 'subscriptionPlusReadOnly', days: 90 };

const FULL_ACCESS: Entitlements = {
  projects: UNLIMITED,
  onePageSummary: true,
  fullReport: UNLIMITED,
  mentorMessages: FAIR_USE,
  competitorEnrichment: true,
  pitchDeck: true,
  quarterlyRefresh: true,
  retention: PAID_RETENTION,
};

export const PLANS: Readonly<Record<PlanId, Plan>> = {
  free: {
    id: 'free',
    priceUsd: 0,
    billing: { kind: 'free' },
    entitlements: {
      projects: { kind: 'count', value: 1 },
      onePageSummary: true,
      fullReport: { kind: 'none' },
      mentorMessages: { kind: 'perDay', value: 3 },
      competitorEnrichment: false,
      pitchDeck: false,
      quarterlyRefresh: false,
      retention: { kind: 'days', value: 30 },
    },
  },
  weekly: {
    id: 'weekly',
    priceUsd: 5,
    billing: { kind: 'once', days: 7 },
    entitlements: {
      projects: { kind: 'count', value: 1 },
      onePageSummary: true,
      fullReport: { kind: 'count', value: 1 },
      mentorMessages: { kind: 'perDay', value: 10 },
      competitorEnrichment: false,
      pitchDeck: true,
      quarterlyRefresh: false,
      retention: PAID_RETENTION,
    },
  },
  monthly: {
    id: 'monthly',
    priceUsd: 17,
    billing: { kind: 'recurring', interval: 'month' },
    entitlements: {
      projects: { kind: 'count', value: 3 },
      onePageSummary: true,
      fullReport: UNLIMITED,
      mentorMessages: FAIR_USE,
      competitorEnrichment: true,
      pitchDeck: true,
      quarterlyRefresh: false,
      retention: PAID_RETENTION,
    },
  },
  annual: {
    id: 'annual',
    priceUsd: 150,
    billing: { kind: 'once', days: 365 },
    entitlements: FULL_ACCESS,
  },
  course: {
    id: 'course',
    priceUsd: 0,
    billing: { kind: 'voucher', months: 12 },
    entitlements: FULL_ACCESS,
  },
  alumni: {
    id: 'alumni',
    priceUsd: 15,
    billing: { kind: 'recurring', interval: 'month' },
    entitlements: FULL_ACCESS,
  },
};

/** Columns of the public comparison table; the course plans are shown beneath it. */
export const COMPARED_PLANS: readonly PlanId[] = ['free', 'weekly', 'monthly', 'annual'];
export const COURSE_PLANS: readonly PlanId[] = ['course', 'alumni'];

/** The column drawn with the gold rule: a business choice, changeable here (D-094). */
export const HIGHLIGHTED_PLAN: PlanId = 'annual';

/** Lowest paid price, quoted on the home page. */
export function lowestPaidPrice(): number {
  return Math.min(
    ...Object.values(PLANS)
      .map((plan) => plan.priceUsd)
      .filter((price) => price > 0),
  );
}
