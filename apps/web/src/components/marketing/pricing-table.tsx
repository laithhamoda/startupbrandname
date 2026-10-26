import { questionsFor } from '@sbn/question-bank';
import { Minus } from 'lucide-react';
import type { ReactNode } from 'react';
import { ButtonLink } from '@/components/ui/button';
import { Money } from '@/components/ui/money';
import { Tabs } from '@/components/ui/tabs';
import {
  COMPARED_PLANS,
  HIGHLIGHTED_PLAN,
  PLANS,
  type Plan,
  type PlanId,
  type Quota,
  type Retention,
} from '@/config/plans';
import type { FeatureKey, PricingContent } from '@/content/pricing';
import { cn } from '@/lib/cn';
import { BidiText } from './bidi-text';

const FEATURES: readonly FeatureKey[] = [
  'questions',
  'report',
  'mentorMessages',
  'projects',
  'retention',
];

/** Replaces "{count}" in a phrase with the number, isolated as a left-to-right run. */
function withCount(template: string, count: number): ReactNode {
  const [before = '', after = ''] = template.split('{count}');
  return (
    <>
      {before}
      <bdi className="num">{count}</bdi>
      {after}
    </>
  );
}

function NotIncluded({ text }: { text: PricingContent }) {
  return (
    <>
      <Minus aria-hidden className="inline size-5 text-muted" />
      <span className="sr-only">{text.notIncluded}</span>
    </>
  );
}

function quotaValue(quota: Quota, text: PricingContent): ReactNode {
  switch (quota.kind) {
    case 'none':
      return text.locked;
    case 'count':
      return <bdi className="num">{quota.value}</bdi>;
    case 'perProject':
      return withCount(text.perProject, quota.value);
    case 'perPurchase':
      return withCount(text.perPurchase, quota.value);
    case 'unlimited':
      return quota.fairUse ? `${text.unlimited}*` : text.unlimited;
  }
}

function retentionValue(retention: Retention, text: PricingContent): ReactNode {
  return retention.kind === 'days'
    ? withCount(text.days, retention.value)
    : withCount(text.readOnlyAfter, retention.days);
}

function featureValue(plan: Plan, feature: FeatureKey, text: PricingContent): ReactNode {
  const { entitlements } = plan;
  switch (feature) {
    case 'projects':
      return quotaValue(entitlements.projects, text);
    case 'questions':
      return withCount(text.questionsCount, questionsFor(entitlements.questions).length);
    case 'report':
      return <BidiText text={text.reportLevels[entitlements.report]} />;
    case 'mentorMessages':
      return entitlements.mentorMessages.kind === 'none' ? (
        <NotIncluded text={text} />
      ) : (
        quotaValue(entitlements.mentorMessages, text)
      );
    case 'retention':
      return retentionValue(entitlements.retention, text);
  }
}

export function PlanPrice({ planId, text }: { planId: PlanId; text: PricingContent }) {
  const plan = PLANS[planId];
  return (
    <span className="grid gap-0.5">
      <span className="font-display text-h3 font-extrabold">
        {plan.priceUsd === 0 ? text.free : <Money value={String(plan.priceUsd)} currency="USD" />}
      </span>
      <span className="text-caption font-normal text-muted">
        <BidiText text={text.billing[planId]} />
      </span>
    </span>
  );
}

function FeatureName({ feature, text }: { feature: FeatureKey; text: PricingContent }) {
  return (
    <>
      <BidiText text={text.features[feature]} />
      {text.soonFeatures.includes(feature) ? (
        <span className="ms-2 inline-block rounded-pill border border-hairline px-2 text-caption font-normal text-muted">
          {text.soon}
        </span>
      ) : null}
    </>
  );
}

function PlanAction({
  planId,
  text,
  checkoutOpen,
}: {
  planId: PlanId;
  text: PricingContent;
  checkoutOpen: boolean;
}) {
  if (planId === 'free') {
    return (
      <ButtonLink href="/signup" variant="primary">
        {text.startFree}
      </ButtonLink>
    );
  }
  // Paid packages open with checkout (M7 step 5); a visitor signs in on the way.
  return checkoutOpen ? (
    <ButtonLink
      href={`/checkout/${planId}`}
      variant={planId === HIGHLIGHTED_PLAN ? 'primary' : 'secondary'}
    >
      {text.buy}
    </ButtonLink>
  ) : (
    <span className="text-small text-muted">{text.paidSoon}</span>
  );
}

const cell = 'border-b border-hairline px-3 py-3 text-start align-top';

/**
 * A comparison table, not identical cards (M1 design plan). From tablet width up it is one
 * table; on phones it becomes one plan at a time behind tabs.
 */
export function PricingTable({
  text,
  checkoutOpen = false,
}: {
  text: PricingContent;
  checkoutOpen?: boolean;
}) {
  return (
    <>
      <div className="hidden md:block">
        {/* Fixed layout: equal plan columns, whatever the length of their text. */}
        <table className="w-full table-fixed border-collapse">
          <caption className="sr-only">{text.tableCaption}</caption>
          <thead>
            <tr>
              <td className="w-[28%] border-b border-control" />
              {COMPARED_PLANS.map((planId) => (
                <th
                  key={planId}
                  scope="col"
                  className={cn(
                    'border-b border-control px-3 pt-4 pb-3 text-start align-bottom',
                    planId === HIGHLIGHTED_PLAN && 'border-t-2 border-t-gold',
                  )}
                >
                  <span className="grid gap-2">
                    <span className="font-display text-body font-bold">
                      {text.planNames[planId]}
                    </span>
                    <PlanPrice planId={planId} text={text} />
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {FEATURES.map((feature) => (
              <tr key={feature}>
                <th scope="row" className={cn(cell, 'ps-0 font-normal')}>
                  <FeatureName feature={feature} text={text} />
                </th>
                {COMPARED_PLANS.map((planId) => (
                  <td key={planId} className={cell}>
                    {featureValue(PLANS[planId], feature, text)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {checkoutOpen ? (
          // One action per package, under its own column.
          <div className="flex pt-6">
            <div className="w-[28%]" />
            {COMPARED_PLANS.map((planId) => (
              <div key={planId} className="flex-1 px-3">
                <PlanAction planId={planId} text={text} checkoutOpen />
              </div>
            ))}
          </div>
        ) : (
          // One action under the table while only the free package can be started.
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3 pt-6">
            <ButtonLink href="/signup" variant="primary">
              {text.startFree}
            </ButtonLink>
            <span className="text-small text-muted">{text.paidPlansSoon}</span>
          </div>
        )}
      </div>

      <div className="md:hidden">
        <Tabs
          label={text.choosePlan}
          defaultValue={HIGHLIGHTED_PLAN}
          tabs={COMPARED_PLANS.map((planId) => ({
            value: planId,
            title: text.planNames[planId],
            content: (
              <div className="grid gap-4">
                <PlanPrice planId={planId} text={text} />
                <dl className="grid border-t border-hairline">
                  {FEATURES.map((feature) => (
                    <div
                      key={feature}
                      className="flex items-start justify-between gap-4 border-b border-hairline py-3"
                    >
                      <dt>
                        <FeatureName feature={feature} text={text} />
                      </dt>
                      <dd className="text-end">{featureValue(PLANS[planId], feature, text)}</dd>
                    </div>
                  ))}
                </dl>
                <div>
                  <PlanAction planId={planId} text={text} checkoutOpen={checkoutOpen} />
                </div>
              </div>
            ),
          }))}
        />
      </div>
    </>
  );
}
