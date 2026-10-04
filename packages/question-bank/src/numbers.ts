import { containsPhrase, fold } from './text';
import type { NumberRange } from './types';

const ARABIC_INDIC = '٠١٢٣٤٥٦٧٨٩';
const PERSIAN = '۰۱۲۳۴۵۶۷۸۹';

/** Scale words in Arabic (MSA and dialects), English and French, as powers of ten. */
const SCALES: readonly { words: readonly string[]; exponent: number }[] = [
  { words: ['الف', 'الاف', 'آلاف', 'thousand', 'k', 'mille'], exponent: 3 },
  // No bare "m": it is as likely to mean metres or minutes.
  { words: ['مليون', 'ملايين', 'million', 'millions', 'mn'], exponent: 6 },
  { words: ['مليار', 'مليارات', 'billion', 'milliard', 'milliards', 'bn'], exponent: 9 },
];
const SCALE_WORDS = SCALES.flatMap((scale) => scale.words);

/** One way to read a number that can be read two ways. */
export interface NumberAlternative {
  value: number;
  /** The number written for this reading only, without separators: "1500" or "1.5". */
  number: string;
  /** What the founder typed, with the number written that way, to put back in the box. */
  text: string;
}

export type NumberReading =
  | { ok: true; value: number }
  /**
   * - empty: nothing typed;
   * - not_a_number: no digit at all (words such as «خمسين» are not guessed);
   * - range: two numbers such as "200-300" (rule R3 offers ranges instead);
   * - ambiguous: a second number, or separators that fit no single way of writing numbers
   *   ("12 5", "1,5000"), where reading only part of the text would be a silent misreading.
   */
  | { ok: false; reason: 'empty' | 'not_a_number' | 'range' | 'ambiguous' }
  /**
   * One "." or "," followed by exactly three digits: "1.500" is 1500 where the mark groups
   * thousands and 1.5 where it is the decimal point (French and Algerian usage). The founder
   * picks; `typed` is the number as they wrote it.
   */
  | {
      ok: false;
      reason: 'two_readings';
      typed: string;
      readings: readonly [NumberAlternative, NumberAlternative];
    };

/** Western digits for Arabic-Indic and Persian ones; every other character stays as typed. */
function asciiDigits(text: string): string {
  return text
    .replace(/[٠-٩]/g, (digit) => String(ARABIC_INDIC.indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String(PERSIAN.indexOf(digit)));
}

/** Western digits for Arabic-Indic and Persian ones, "." for the Arabic decimal separator. */
export function westernDigits(text: string): string {
  return asciiDigits(text).replace(/٫/g, '.').replace(/٬/g, ',');
}

const RANGE = /\d\s*(?:-|–|—|إلى|الى|to|à)\s*\d/i;
/**
 * Digits with the marks that may sit between them: "." and ",", the Arabic decimal separator ٫
 * and thousands separator ٬, and the spaces that group thousands in French (U+00A0, U+202F).
 */
const NUMBER = /\d+(?:[.,٫٬ \u00A0\u202F]\d+)*/;
const MARKS = /[.,٫٬ \u00A0\u202F]/g;

/** The whole and fraction digits of one reading. */
interface Digits {
  whole: string;
  fraction: string;
}

/**
 * The ways a typed number can be read (Unicode CLDR number symbols for ar, en and fr): none when
 * its marks fit no convention, two for "1.500" or "1,500". Thousands are grouped by one kind of
 * mark, three digits at a time; the decimal mark comes last and once.
 */
function readingsOf(token: string): Digits[] {
  const groups = token.split(MARKS);
  const marks = (token.match(MARKS) ?? []).map((mark) => (/\s/.test(mark) ? ' ' : mark));
  const last = marks.at(-1);
  if (last === undefined) return [{ whole: token, fraction: '' }];
  const times = (mark: string) => marks.filter((other) => other === mark).length;

  const reading = (decimal: boolean): Digits | null => {
    const whole = decimal ? groups.slice(0, -1) : groups;
    const grouping = decimal ? marks.slice(0, -1) : marks;
    const [first = '', ...thousands] = whole;
    if (new Set(grouping).size > 1) return null;
    if (thousands.length > 0 && (first.length > 3 || thousands.some((group) => group.length !== 3)))
      return null;
    return { whole: whole.join(''), fraction: decimal ? (groups.at(-1) ?? '') : '' };
  };
  const only = (digits: Digits | null) => (digits ? [digits] : []);

  // The Arabic decimal separator, or both "." and ",": the last mark is the decimal point.
  if (times('٫') > 0 || (times('.') > 0 && times(',') > 0)) {
    return (last === '٫' || last === '.' || last === ',') && times(last) === 1
      ? only(reading(true))
      : [];
  }
  // Spaces or ٬ only, or "1.500.000": every mark groups thousands.
  if ((last !== '.' && last !== ',') || times(last) > 1) return only(reading(false));

  // One "." or "," and it is the last mark: "12,5", "1.5", "1.500".
  const decimal = reading(true);
  if (!decimal) return [];
  // No thousands start with a zero: "0.500" is a half.
  if (/^0+$/.test(decimal.whole)) return [decimal];
  const fraction = groups.at(-1) ?? '';
  if (fraction.length === 3) {
    const grouped = reading(false);
    if (grouped) return [grouped, decimal];
    // "1500.000" cannot group thousands, so its point is a decimal point.
    return last === '.' && (groups.at(-2) ?? '').length > 3 ? [decimal] : [];
  }
  // A decimal comma has one or two digits ("12,5", "12,50"); a point may have more.
  return last === '.' || fraction.length <= 2 ? [decimal] : [];
}

/** whole.fraction × 10^exponent, computed on the digits, so that 1.1 thousand is exactly 1100. */
function decimalValue({ whole, fraction }: Digits, exponent: number): number {
  const digits = whole + fraction;
  const point = whole.length + exponent;
  return Number(
    point >= digits.length
      ? digits.padEnd(point, '0')
      : `${digits.slice(0, point)}.${digits.slice(point)}`,
  );
}

/** The scale word right after the number, as a power of ten ("2 مليون", "3k"). */
function exponentAfter(rest: string): number {
  const text = ` ${fold(rest)} `;
  return (
    SCALES.find((scale) => scale.words.some((word) => text.startsWith(` ${fold(word)} `)))
      ?.exponent ?? 0
  );
}

/**
 * Reads one number from what a founder typed: "1500", "1 500", "1.500.000", "12,5", "١٥٠٠",
 * "١٫٥ مليون", "2k", "3 آلاف". It never guesses: a range such as "200-300" is left to rule R3, a
 * second number or separators that fit no convention are `ambiguous`, and "1.500" comes back
 * with both readings for the founder to choose. Currency words are handled separately
 * (currency.ts).
 */
export function readNumber(input: string): NumberReading {
  const typed = input.trim();
  // The same length as `typed`: each digit becomes one Western digit.
  const text = asciiDigits(typed);
  if (text === '') return { ok: false, reason: 'empty' };
  if (RANGE.test(text)) return { ok: false, reason: 'range' };

  const match = NUMBER.exec(text);
  if (!match) return { ok: false, reason: 'not_a_number' };
  const [token] = match;
  const start = match.index;
  const end = start + token.length;
  const before = text.slice(0, start);
  const after = text.slice(end);
  // All of the number, and only one: a second number, a mark just before the digits (".5") or a
  // scale word before them («مليون و500») would otherwise be dropped without a word (UX-2).
  if (/\d/.test(after) || /[.,٫٬]$/.test(before) || containsPhrase(before, SCALE_WORDS)) {
    return { ok: false, reason: 'ambiguous' };
  }

  const negative = /[-−]$/.test(before);
  const exponent = exponentAfter(after);
  const signed = (digits: Digits) => {
    const value = decimalValue(digits, exponent);
    return negative && value !== 0 ? -value : value;
  };
  const [first, second] = readingsOf(token);
  if (!first) return { ok: false, reason: 'ambiguous' };
  if (!Number.isFinite(signed(first))) return { ok: false, reason: 'not_a_number' };
  if (!second) return { ok: true, value: signed(first) };

  const alternative = (digits: Digits): NumberAlternative => {
    const number = String(decimalValue(digits, 0));
    return {
      value: signed(digits),
      number: negative ? `-${number}` : number,
      text: `${typed.slice(0, start)}${number}${typed.slice(end)}`,
    };
  };
  return {
    ok: false,
    reason: 'two_readings',
    typed: typed.slice(start, end),
    readings: [alternative(first), alternative(second)],
  };
}

/**
 * The value stored when a founder picks a suggested range (R3): its middle, or its floor when
 * open-ended. A whole-number question stores a whole number ("1–2" gives 2), which its own
 * schema then accepts (UX-1).
 */
export function rangeValue(range: NumberRange, integer: boolean): number {
  const value = range.max === undefined ? range.min : (range.min + range.max) / 2;
  return integer ? Math.round(value) : value;
}
