'use server';

import { unstable_rethrow } from 'next/navigation';
import { z } from 'zod';
import { getCheckoutEnv } from '@/env/server';
import { routing } from '@/i18n/routing';
import { requireAccount } from '@/lib/auth/session';
import { errorFields, log } from '@/lib/log';
import { accountPlanOf } from '@/lib/payments/account-plan';
import { isPurchasable, offerFor } from '@/lib/payments/offer';

const localeSchema = z.enum(routing.locales);

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
  /** The account already has this package or a better one. */
  | { readonly status: 'owned' }
  /** Checkout is not configured in this environment, or the package is not for sale. */
  | { readonly status: 'closed' }
  /** Too many checkouts started today (payments.checkouts_per_day). */
  | { readonly status: 'limit' }
  | { readonly status: 'error' };

/**
 * Starts a checkout for the signed-in account (M7 step 5, D-317): the 18+ confirmation is recorded
 * with it (D-086), the price is the package's, or the difference for an upgrade (D-313), and Paddle
 * receives an opaque reference, never the user id. The browser opens the overlay with the answer;
 * access changes only when the verified webhook arrives (D-309).
 */
export async function beginCheckout(
  localeInput: string,
  planInput: string,
  formData: FormData,
): Promise<CheckoutStart> {
  const locale = localeSchema.parse(localeInput);
  if (formData.get('adult') !== 'on') return { status: 'adult_required' };
  const env = getCheckoutEnv();
  if (env === null || !isPurchasable(planInput)) return { status: 'closed' };

  try {
    const { supabase, user } = await requireAccount(locale);
    const offer = offerFor(await accountPlanOf(supabase), planInput, env.prices);
    if (offer.status === 'owned') return { status: 'owned' };

    const { data, error } = await supabase.rpc('start_checkout', {
      p_plan_id: offer.planId,
      // A package covers the account (D-315). The generated types mark every argument required, but
      // the function reads null as no project.
      p_project_id: null as unknown as string,
      p_adult_confirmed: true,
    });
    if (error) {
      if (error.code === '54000') return { status: 'limit' };
      await log.error('payments.checkout_failed', { code: error.code, stage: 'start' });
      return { status: 'error' };
    }
    return {
      status: 'ready',
      priceId: offer.priceId,
      checkoutRef: data,
      email: user.email ?? null,
      clientToken: env.clientToken,
      environment: env.environment,
    };
  } catch (error) {
    unstable_rethrow(error);
    await log.error('payments.checkout_failed', { ...errorFields(error), stage: 'start' });
    return { status: 'error' };
  }
}
