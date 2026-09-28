import { randomUUID } from 'node:crypto';

/**
 * De-identification before every model call (CLAUDE.md rule 5, D-107). Only project content may
 * leave: emails, phone numbers and the account's own identifiers are replaced by placeholders,
 * and the user ID never travels, only a random token made for the request.
 */

export interface Identity {
  email?: string | null;
  /** Names known for the account (for example from Google sign-in), replaced wherever they appear. */
  names?: readonly string[];
}

const ARABIC_INDIC = '٠١٢٣٤٥٦٧٨٩';
const PERSIAN = '۰۱۲۳۴۵۶۷۸۹';

function westernDigits(text: string): string {
  return text
    .replace(/[٠-٩]/g, (digit) => String(ARABIC_INDIC.indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String(PERSIAN.indexOf(digit)));
}

const EMAIL = /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.[\p{L}]{2,}/gu;

/**
 * A phone number: an international prefix (+ or 00) or a leading 0, then 8 to 14 more digits,
 * optionally split by spaces, dots, dashes or brackets. Amounts ("1500", "1,500,000", "2026")
 * never start with 0 or +, so they are left alone.
 */
const PHONE = /(?<![\p{L}\p{N}])(?:\+|00|0)(?:[\s.()-]*\d){8,14}(?![\p{L}\p{N}])/gu;

export const PLACEHOLDERS = { email: '[email]', phone: '[phone]', name: '[name]' } as const;

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** The text with emails, phone numbers and the account's identifiers replaced. */
export function deidentify(text: string, identity: Identity = {}): string {
  let result = westernDigitsInPhones(text);
  const email = identity.email?.trim();
  if (email) result = result.replace(new RegExp(escapeRegExp(email), 'giu'), PLACEHOLDERS.email);
  result = result.replace(EMAIL, PLACEHOLDERS.email);
  result = result.replace(PHONE, PLACEHOLDERS.phone);
  for (const name of identity.names ?? []) {
    const trimmed = name.trim();
    // Very short strings would match inside ordinary words.
    if (trimmed.length < 3) continue;
    result = result.replace(
      new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(trimmed)}(?![\\p{L}\\p{N}])`, 'giu'),
      PLACEHOLDERS.name,
    );
  }
  return result;
}

/** Phone numbers typed in Arabic-Indic digits are matched like Western ones. */
function westernDigitsInPhones(text: string): string {
  return /[٠-٩۰-۹]/.test(text) ? westernDigitsKeepingText(text) : text;
}

function westernDigitsKeepingText(text: string): string {
  // Only digit runs that could be phone numbers are converted; other text is untouched.
  return text.replace(/(?:[+]|٠٠|۰۰|[٠۰])[٠-٩۰-۹\s.()-]{8,}/g, (run) => westernDigits(run));
}

/** A random identifier for one request, in place of the user ID (rule 5). */
export function requestToken(): string {
  return randomUUID();
}
