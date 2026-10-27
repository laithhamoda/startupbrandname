'use server';

import { revalidatePath } from 'next/cache';
import { unstable_rethrow } from 'next/navigation';
import { z } from 'zod';
import { routing } from '@/i18n/routing';
import { errorFields, log } from '@/lib/log';
import { requireAdmin } from './guard';
import { usdToCents } from './money';

const localeSchema = z.enum(routing.locales);

/** What an admin form shows after a submit. `output` is text to copy, such as the issued codes. */
export type ToolState =
  | { readonly status: 'idle' }
  | { readonly status: 'done'; readonly output?: string; readonly count?: number }
  | { readonly status: 'error'; readonly reason: 'denied' | 'invalid' | 'failed' };

const IDLE_FAILED: ToolState = { status: 'error', reason: 'failed' };
const INVALID: ToolState = { status: 'error', reason: 'invalid' };

/** The database's refusal as a reason the form can explain; the log keeps the code only. */
function reasonOf(code: string | undefined): 'denied' | 'invalid' | 'failed' {
  if (code === '42501') return 'denied';
  // 22023 is the tools' own "no" (unknown plan, account or type); 23514 a check constraint.
  if (code === '22023' || code === '23514' || code === '22P02') return 'invalid';
  return 'failed';
}

type Tools = Awaited<ReturnType<typeof requireAdmin>>['supabase'];

/**
 * Runs one admin tool: the guard first (a 404 or the code page for anyone who is not an admin at
 * aal2), then the database function, which checks the same and writes the audit row.
 */
async function run(
  localeInput: string,
  tool: string,
  body: (supabase: Tools) => Promise<ToolState>,
): Promise<ToolState> {
  const locale = localeSchema.parse(localeInput);
  try {
    const { supabase } = await requireAdmin(locale);
    const state = await body(supabase);
    if (state.status === 'done') revalidatePath(`/${locale}/admin`, 'layout');
    if (state.status === 'error') await log.warn('admin.tool_refused', { stage: tool });
    return state;
  } catch (error) {
    unstable_rethrow(error);
    await log.error('admin.tool_failed', { ...errorFields(error), stage: tool });
    return IDLE_FAILED;
  }
}

function failed(tool: string, code: string | undefined): ToolState {
  void log.warn('admin.tool_refused', { stage: tool, code });
  return { status: 'error', reason: reasonOf(code) };
}

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === '' ? undefined : value))
    .optional();

const issueSchema = z.object({
  type: z.string().regex(/^[a-z][a-z0-9_]{0,39}$/),
  count: z.coerce.number().int().min(1).max(1000),
  affiliate: z.union([z.uuid(), z.literal('')]).transform((value) => value || undefined),
  note: optionalText(200),
});

/** Issues a batch of codes and shows them once (D-328). The audit row keeps no code. */
export async function issueBatch(
  localeInput: string,
  _previous: ToolState,
  formData: FormData,
): Promise<ToolState> {
  const input = issueSchema.safeParse({
    type: formData.get('type'),
    count: formData.get('count'),
    affiliate: formData.get('affiliate') ?? '',
    note: formData.get('note') ?? undefined,
  });
  if (!input.success) return INVALID;
  return run(localeInput, 'issue_batch', async (supabase) => {
    const { data, error } = await supabase.rpc('admin_issue_batch', {
      p_type: input.data.type,
      p_count: input.data.count,
      ...(input.data.affiliate ? { p_affiliate: input.data.affiliate } : {}),
      ...(input.data.note ? { p_note: input.data.note } : {}),
    });
    if (error) return failed('issue_batch', error.code);
    return { status: 'done', output: data.join('\n'), count: data.length };
  });
}

const affiliateSchema = z.object({
  name: z.string().trim().min(1).max(100),
  amount: z.string().transform(usdToCents).pipe(z.number().int().min(1).max(999999)),
});

/** Adds an affiliate whose commission is a fixed amount for each activated code (D-326). */
export async function createAffiliate(
  localeInput: string,
  _previous: ToolState,
  formData: FormData,
): Promise<ToolState> {
  const input = affiliateSchema.safeParse({
    name: formData.get('name'),
    amount: formData.get('amount'),
  });
  if (!input.success) return INVALID;
  return run(localeInput, 'create_affiliate', async (supabase) => {
    const { error } = await supabase.rpc('admin_create_affiliate', {
      p_name: input.data.name,
      p_amount_usd_cents: input.data.amount,
    });
    return error ? failed('create_affiliate', error.code) : { status: 'done' };
  });
}

/** Marks every due commission of an affiliate as paid, after the transfer outside the platform. */
export async function payCommissions(
  localeInput: string,
  affiliateInput: string,
): Promise<ToolState> {
  const affiliate = z.uuid().safeParse(affiliateInput);
  if (!affiliate.success) return INVALID;
  return run(localeInput, 'pay_commissions', async (supabase) => {
    const { data, error } = await supabase.rpc('admin_pay_commissions', {
      p_affiliate: affiliate.data,
    });
    return error ? failed('pay_commissions', error.code) : { status: 'done', count: data };
  });
}

const grantSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  plan: z.enum(['strategist', 'commander', 'course']),
  project: z.union([z.uuid(), z.literal('')]).transform((value) => value || null),
  days: z.coerce.number().int().min(1).max(730),
});

/** Gives an account access by hand: a package for one project, or the course plan (D-319, D-320). */
export async function grantSubscription(
  localeInput: string,
  _previous: ToolState,
  formData: FormData,
): Promise<ToolState> {
  const input = grantSchema.safeParse({
    email: formData.get('email'),
    plan: formData.get('plan'),
    project: formData.get('project') ?? '',
    days: formData.get('days'),
  });
  if (!input.success) return INVALID;
  return run(localeInput, 'grant_subscription', async (supabase) => {
    const { error } = await supabase.rpc('admin_grant_subscription', {
      p_email: input.data.email,
      p_plan_id: input.data.plan,
      ...(input.data.project ? { p_project_id: input.data.project } : {}),
      p_days: input.data.days,
    });
    return error ? failed('grant_subscription', error.code) : { status: 'done' };
  });
}

/** Ends an access given by hand or by a voucher, now. A paid one ends with its refund in Paddle. */
export async function endSubscription(
  localeInput: string,
  subscriptionInput: string,
): Promise<ToolState> {
  const subscription = z.uuid().safeParse(subscriptionInput);
  if (!subscription.success) return INVALID;
  return run(localeInput, 'end_subscription', async (supabase) => {
    const { error } = await supabase.rpc('admin_end_subscription', { p_id: subscription.data });
    return error ? failed('end_subscription', error.code) : { status: 'done' };
  });
}
