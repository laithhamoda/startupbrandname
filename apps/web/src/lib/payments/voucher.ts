import { createHmac } from 'node:crypto';
import { z } from 'zod';

/** What an activation answers (activate_voucher() in the database, plus what the app adds). */
export type VoucherOutcome =
  | 'activated'
  /** Unknown, used, revoked, expired or malformed: one answer, so a guess learns nothing. */
  | 'invalid'
  /** Five failed attempts from this account or this network (CLAUDE.md §3). */
  | 'locked'
  /** The account already has this plan running; the code is kept. */
  | 'in_use'
  /** The 18+ box was not ticked (D-086). */
  | 'adult_required'
  /** Vouchers are not configured in this environment, or the call failed. */
  | 'error';

/** The raw input; the database cleans case, spaces and dashes, and the cap only bounds the call. */
export const voucherCodeSchema = z.string().max(64);

const DATABASE_OUTCOMES: readonly VoucherOutcome[] = ['activated', 'invalid', 'locked', 'in_use'];

/** The database's answer as an outcome; anything else is an error, never a success. */
export function outcomeOf(answer: unknown): VoucherOutcome {
  return DATABASE_OUTCOMES.find((outcome) => outcome === answer) ?? 'error';
}

/**
 * The address of the visitor as Vercel reports it: `x-real-ip`, else the first `x-forwarded-for`
 * entry. Unknown addresses share one bucket, which locks sooner and never later.
 */
export function clientAddress(headers: Pick<Headers, 'get'>): string {
  const real = headers.get('x-real-ip')?.trim();
  if (real) return real;
  const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded === undefined || forwarded === '' ? 'unknown' : forwarded;
}

/**
 * A keyed hash of the address. The database keeps only this, so the table holds no readable
 * address, and the key (the server's secret) stops anyone rebuilding it from a list of addresses.
 */
export function networkHash(address: string, key: string): string {
  return createHmac('sha256', key).update(`voucher-network:${address}`).digest('hex');
}
