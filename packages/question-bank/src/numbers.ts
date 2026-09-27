import { fold } from './text';

const ARABIC_INDIC = '٠١٢٣٤٥٦٧٨٩';
const PERSIAN = '۰۱۲۳۴۵۶۷۸۹';

/** Scale words in Arabic (MSA and dialects), English and French. Checked on folded text. */
const SCALES: readonly { words: readonly string[]; factor: number }[] = [
  { words: ['الف', 'الاف', 'آلاف', 'thousand', 'k', 'mille'], factor: 1_000 },
  // No bare "m": it is as likely to mean metres or minutes.
  { words: ['مليون', 'ملايين', 'million', 'millions', 'mn'], factor: 1_000_000 },
  { words: ['مليار', 'مليارات', 'billion', 'milliard', 'milliards', 'bn'], factor: 1_000_000_000 },
];

export type NumberReading =
  { ok: true; value: number } | { ok: false; reason: 'empty' | 'not_a_number' | 'range' };

/** Western digits for Arabic-Indic and Persian ones, "." for the Arabic decimal separator. */
export function westernDigits(text: string): string {
  return text
    .replace(/[٠-٩]/g, (digit) => String(ARABIC_INDIC.indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String(PERSIAN.indexOf(digit)))
    .replace(/٫/g, '.')
    .replace(/٬/g, ',');
}

/**
 * Reads one number from what a founder typed: "1500", "1,500", "١٥٠٠", "1.5 مليون", "2k",
 * "3 آلاف". A range such as "200-300" is not guessed (rule R3 offers ranges instead), and nothing
 * else in the text is interpreted. Currency words are handled separately (currency.ts).
 */
export function readNumber(input: string): NumberReading {
  const text = westernDigits(input).trim();
  if (text === '') return { ok: false, reason: 'empty' };
  if (/\d\s*(?:-|–|—|إلى|الى|to|à)\s*\d/i.test(text)) return { ok: false, reason: 'range' };

  const match = /(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d+))?/.exec(text);
  if (!match) return { ok: false, reason: 'not_a_number' };
  const [whole = '', integerPart = '', fraction] = match;
  let value = Number(`${integerPart.replace(/,/g, '')}${fraction ? `.${fraction}` : ''}`);
  if (!Number.isFinite(value)) return { ok: false, reason: 'not_a_number' };

  const rest = ` ${fold(text.slice(match.index + whole.length))} `;
  for (const scale of SCALES) {
    if (scale.words.some((word) => rest.startsWith(` ${fold(word)} `))) {
      value *= scale.factor;
      break;
    }
  }
  return { ok: true, value };
}

/** The representative value stored when a founder picks a suggested range (R3). */
export function rangeValue(range: { min: number; max?: number }): number {
  return range.max === undefined ? range.min : (range.min + range.max) / 2;
}
