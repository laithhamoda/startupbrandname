import {
  currencyExponent,
  rateToDecimalString,
  rateToPercentString,
  type Money,
  type Rate,
} from '@sbn/engine';
import { isIsoDate } from '../legal-path';

/*
 * Numbers as the report writes them (D-267): Western digits, a comma between thousands, the
 * currency's own number of decimals, a real minus sign. All integer arithmetic on money and rates:
 * nothing here goes through a floating-point number.
 */

/** The minus sign of the report: U+2212, which is not the hyphen of a word. */
export const MINUS = '−';

/** "1234567" as "1,234,567". Walks the digits instead of using a pattern. */
export function groupThousands(digits: string): string {
  let out = '';
  for (let index = 0; index < digits.length; index += 1) {
    const fromEnd = digits.length - index;
    if (index > 0 && fromEnd % 3 === 0) out += ',';
    out += digits.charAt(index);
  }
  return out;
}

/** A whole number, grouped, with a minus sign when negative. */
export function formatInteger(value: bigint | number): string {
  const big = typeof value === 'bigint' ? value : BigInt(Math.trunc(value));
  const negative = big < 0n;
  const digits = (negative ? -big : big).toString();
  return `${negative ? MINUS : ''}${groupThousands(digits)}`;
}

/**
 * An amount's number: whole units grouped, then the currency's decimals exactly as ISO 4217 has
 * them (3 for the Jordanian dinar, 2 for the Algerian dinar, none for the yen). No currency label.
 */
export function formatMoneyNumber(money: Money): string {
  const exponent = currencyExponent(money.currency);
  const negative = money.minor < 0n;
  const magnitude = negative ? -money.minor : money.minor;
  const scale = 10n ** BigInt(exponent);
  const whole = (magnitude / scale).toString();
  const fraction =
    exponent === 0 ? '' : `.${(magnitude % scale).toString().padStart(exponent, '0')}`;
  return `${negative ? MINUS : ''}${groupThousands(whole)}${fraction}`;
}

/** Walks back over the trailing zeros of a decimal and then over a bare point. */
export function trimDecimalZeros(text: string): string {
  if (!text.includes('.')) return text;
  let end = text.length;
  while (end > 0 && text.charCodeAt(end - 1) === 48) end -= 1;
  if (end > 0 && text.charCodeAt(end - 1) === 46) end -= 1;
  return text.slice(0, end);
}

function withTypographicMinus(text: string): string {
  return text.startsWith('-') ? `${MINUS}${text.slice(1)}` : text;
}

/** A rate as a percentage with at most two decimals: 3/8 is "37.5%", 3/5 is "60%". */
export function formatPercent(rate: Rate): string {
  return `${withTypographicMinus(trimDecimalZeros(rateToPercentString(rate, 2)))}%`;
}

/** A percentage that always shows its sign: "+28.3%" or "−26.2%". Zero has none. */
export function formatSignedPercent(rate: Rate): string {
  const text = formatPercent(rate);
  return text.startsWith(MINUS) || rate.num === 0n ? text : `+${text}`;
}

/** A ratio as a plain number with at most four decimals: 8, 0.6, 1.1. */
export function formatRatio(rate: Rate): string {
  return withTypographicMinus(trimDecimalZeros(rateToDecimalString(rate, 4)));
}

/** A date written YYYY-MM-DD, as given. Throws on anything else so a bad date never prints. */
export function formatDate(isoDate: string): string {
  if (!isIsoDate(isoDate)) throw new Error(`Not a YYYY-MM-DD date: ${isoDate}`);
  return isoDate;
}

/** The label of a currency written for a reader: its own code unless it is the project's. */
export function labelOfCurrency(
  currency: string,
  project: { readonly currency: string; readonly currencyLabel: string },
): string {
  return currency === project.currency ? project.currencyLabel : currency;
}

/** Whether a label is Latin script and so reads left to right (a code such as USD). */
export function isLatinLabel(label: string): boolean {
  if (label === '') return false;
  for (const char of label) {
    if (char.charCodeAt(0) > 0x7f) return false;
  }
  return true;
}
