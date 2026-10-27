/**
 * US dollars typed by an admin ("2", "2.5", "2.50") as whole cents, or null when it is not an
 * amount with at most two decimals. Text arithmetic, so no floating point is involved.
 */
export function usdToCents(text: string): number | null {
  const match = /^(\d{1,4})(?:\.(\d{1,2}))?$/.exec(text.trim());
  if (!match) return null;
  const [, whole = '', fraction = ''] = match;
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}

/** Whole US cents as dollars with two decimals: 250 gives "2.50". */
export function centsToUsd(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  return `${sign}${String(Math.floor(abs / 100))}.${String(abs % 100).padStart(2, '0')}`;
}
