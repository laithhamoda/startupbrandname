'use server';

import { unstable_rethrow } from 'next/navigation';
import { z } from 'zod';
import { MENTOR_PACK } from '@/config/plans';
import { getCheckoutEnv, getMentorPackCheckout } from '@/env/server';
import { routing } from '@/i18n/routing';
import { requireAccount } from '@/lib/auth/session';
import { errorFields, log } from '@/lib/log';
import { projectPlanOf } from '@/lib/payments/account-plan';
import { isPurchasable, offerFor } from '@/lib/payments/offer';
import type { SupabaseServerClient } from '@/lib/supabase/server';

const localeSchema = z.enum(routing.locales);
const projectSchema = z.uuid();

/** What the checkout form opens Paddle's overlay with, or why it cannot. */
export type CheckoutStart =
  | {
      readonly status: 'ready';
      readonly priceId: string;
      readonly checkoutRef: string;
      readonly email: string | null;
      readonly clientToken: string;
      readonly environment: 'sandbox' | 'production';
    }
  /** The 18+ box was not ticked (D-086). */
  | { readonly status: 'adult_required' }
  /** The project already has this package or a better one. */
  | { readonly status: 'owned' }
  /** Checkout is not configured in this environment, or the package is not for sale. */
  | { readonly status: 'closed' }
  /** Too many checkouts started today (payments.checkouts_per_day). */
  | { readonly status: 'limit' }
  | { readonly status: 'error' };

/**
 * Records the checkout of `planId` for one project of the account and answers what the overlay
 * opens with. The database checks the project is the buyer's own and keeps the 18+ confirmation
 * (D-086); Paddle receives an opaque reference, never the user id.
 */
async function startCheckout(
  supabase: SupabaseServerClient,
  email: string | null,
  checkout: {
    readonly planId: string;
    readonly projectId: string;
    readonly priceId: string;
    readonly clientToken: string;
    readonly environment: 'sandbox' | 'production';
  },
): Promise<CheckoutStart> {
  const { data, error } = await supabase.rpc('start_checkout', {
    p_plan_id: checkout.planId,
    // One purchase, one project (D-320).
    p_project_id: checkout.projectId,
    p_adult_confirmed: true,
  });
  if (error) {
    if (error.code === '54000') return { status: 'limit' };
    await log.error('payments.checkout_failed', { code: error.code, stage: 'start' });
    return { status: 'error' };
  }
  return {
    status: 'ready',
    priceId: checkout.priceId,
    checkoutRef: data,
    email,
    clientToken: checkout.clientToken,
    environment: checkout.environment,
  };
}

/**
 * Starts a checkout for one project of the signed-in account (M7 steps 5 and 6b, D-317, D-320):
 * the price is the package's, or the difference when the project moves up (D-313). The browser
 * opens the overlay with the answer; access changes only when the verified webhook arrives (D-309).
 */
export async function beginCheckout(
  localeInput: string,
  planInput: string,
  projectInput: string,
  formData: FormData,
): Promise<CheckoutStart> {
  const locale = localeSchema.parse(localeInput);
  if (formData.get('adult') !== 'on') return { status: 'adult_required' };
  const env = getCheckoutEnv();
  const project = projectSchema.safeParse(projectInput);
  if (env === null || !isPurchasable(planInput) || !project.success) return { status: 'closed' };

  try {
    const { supabase, user } = await requireAccount(locale);
    const offer = offerFor(await projectPlanOf(supabase, project.data), planInput, env.prices);
    if (offer.status === 'owned') return { status: 'owned' };
    return await startCheckout(supabase, user.email ?? null, {
      planId: offer.planId,
      projectId: project.data,
      priceId: offer.priceId,
      clientToken: env.clientToken,
      environment: env.environment,
    });
  } catch (error) {
    unstable_rethrow(error);
    await log.error('payments.checkout_failed', { ...errorFields(error), stage: 'start' });
    return { status: 'error' };
  }
}

/**
 * Starts a checkout of the mentor pack for one project of the signed-in account (M7 step 6d,
 * D-322): any project, free ones included, as many times as the founder wants. The messages are
 * added only when the verified webhook arrives.
 */
export async function beginMentorPackCheckout(
  localeInput: string,
  projectInput: string,
  formData: FormData,
): Promise<CheckoutStart> {
  const locale = localeSchema.parse(localeInput);
  if (formData.get('adult') !== 'on') return { status: 'adult_required' };
  const env = getMentorPackCheckout();
  const project = projectSchema.safeParse(projectInput);
  if (env === null || !project.success) return { status: 'closed' };

  try {
    const { supabase, user } = await requireAccount(locale);
    return await startCheckout(supabase, user.email ?? null, {
      planId: MENTOR_PACK.id,
      projectId: project.data,
      priceId: env.priceId,
      clientToken: env.clientToken,
      environment: env.environment,
    });
  } catch (error) {
    unstable_rethrow(error);
    await log.error('payments.checkout_failed', { ...errorFields(error), stage: 'start' });
    return { status: 'error' };
  }
}
