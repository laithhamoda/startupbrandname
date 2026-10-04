import { randomUUID } from 'node:crypto';

/**
 * De-identification before every model call (CLAUDE.md rule 5, D-107, D-148). Only project
 * content may leave: the account's own names and email, other email addresses, phone numbers,
 * links to a profile or a chat, IBANs and ID numbers are replaced by numbered placeholders
 * ("[phone1]"), and the user ID never travels, only a random token made for the request.
 * reidentify() puts the founder's own text back into what the model returns, so a placeholder
 * never reaches a saved answer or the confirmation text (D-119).
 *
 * Every pattern is bounded (CodeQL js/polynomial-redos): answers are at most 4000 characters, and
 * deidentify.test.ts times the worst inputs. A number is replaced only when it cannot be an
 * amount: it starts with + or 0, or it follows a contact or ID word and no currency follows it.
 * Amounts, years and counts stay as written (the negative tests are mandatory).
 */

/** Text that went through deidentify(). Model prompts accept nothing else (PRIV-7). */
export type Deidentified = string & { readonly __deidentified: true };

export interface Identity {
  email?: string | null;
  /** Names from the sign-in profile (for example Google's), replaced wherever they appear. */
  names?: readonly string[];
}

export interface DeidentifiedText {
  text: Deidentified;
  /** Each placeholder and the exact text it stands for, for reidentify(). */
  originals: ReadonlyMap<string, string>;
}

type Kind = 'email' | 'phone' | 'name' | 'link' | 'iban' | 'id';

/** A Western, Arabic-Indic or Persian digit: founders type all three. */
const DIGIT = '[0-9٠-٩۰-۹]';
const NOT_DIGIT = '[^0-9٠-٩۰-۹\\n]';
/** Nothing letter- or digit-like right before or after a match. */
const START = '(?<![\\p{L}\\p{N}])';
const END = '(?![\\p{L}\\p{N}])';
/** Arabic prefixes written attached to the next word: و ف ب ل ك. */
const ARABIC_PREFIX = '[وفبلك]{0,2}';

/** A number followed by a currency is an amount, never a phone or an ID number. */
const NO_CURRENCY =
  '(?!\\s{0,3}(?:سنتيم|دينار|دنانير|دج|د\\.[جأ]|ريال|درهم|جنيه|ليرة|دولار|يورو|centimes?|dinars?|dollars?|euros?|riyals?|dirhams?|pounds?|da|usd|eur|dzd|jod|sar|aed|egp|mad)(?!\\p{L})|\\s{0,3}[$€£])';

/**
 * An email address. A match starts where a run of local-part characters starts, and both parts
 * are bounded (RFC 5321: 64 and 253), so no input makes it backtrack for long (TEST-M2).
 */
const EMAIL = /(?<![\p{L}\p{N}._%+-])[\p{L}\p{N}._%+-]{1,64}@[\p{L}\p{N}.-]{1,253}\.\p{L}{2,63}/gu;

/** A tel: link, or an address with a path, such as wa.me/962…, t.me/… or instagram.com/…. */
const LINK = new RegExp(
  `${START}(?:tel:\\+?(?:[().-]?${DIGIT}){3,20}` +
    `|(?:https?:\\/\\/)?(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\\.){1,8}[a-z]{2,63}\\/[^\\s<>"]{1,500})`,
  'giu',
);

/** An IBAN: country code, check digits, then groups of four, with or without spaces. */
const IBAN =
  /(?<![\p{L}\p{N}])[A-Z]{2}[0-9]{2}(?: ?[A-Za-z0-9]{4}){3,7}(?: ?[A-Za-z0-9]{1,3})?(?![\p{L}\p{N}])/gu;

const ID_WORDS = [
  'الرقم الوطني',
  'رقمي الوطني',
  'رقم وطني',
  'رقم الهوية',
  'هويتي',
  'الهوية',
  'رقم جواز السفر',
  'جواز السفر',
  'جواز سفري',
  'رقم الجواز',
  'رقم التعريف',
  'التعريف الوطني',
  'بطاقة التعريف',
  'البطاقة الوطنية',
  'الضمان الاجتماعي',
  'national id',
  'national number',
  'id number',
  'identity',
  'passport',
  'social security',
  'ssn',
  'nin',
  'cin',
  "carte d['’]identit[eé]",
  'passeport',
  'num[eé]ro national',
  'id',
];

/** 10 to 25 digits after an ID word, optionally split by single spaces or dashes. */
const ID_NUMBER = new RegExp(
  `(${START}${ARABIC_PREFIX}(?:${ID_WORDS.join('|')})${END}${NOT_DIGIT}{0,20}?)` +
    `([A-Z]{0,2}${DIGIT}(?:[ -]?${DIGIT}){9,24})${END}${NO_CURRENCY}`,
  'giu',
);

const CONTACT_WORDS = [
  'رقم الهاتف',
  'رقم الجوال',
  'رقم الموبايل',
  'رقم الواتساب',
  'رقمي',
  'اتصال',
  'اتصل',
  'هاتفي',
  'هاتف',
  'تلفوني',
  'تلفون',
  'تليفون',
  'جوالي',
  'جوال',
  'موبايلي',
  'موبايل',
  'واتساب',
  'واتس اب',
  'واتس',
  'وتساب',
  'تيليجرام',
  'تلغرام',
  'فايبر',
  'whatsapp',
  'whats app',
  'telegram',
  'viber',
  'phone',
  'mobile',
  'call',
  'contact',
  't[eé]l[eé]phone',
  'portable',
  'appel',
  'tel',
];

/**
 * An international number written without + or 00 (11 to 15 digits, such as 962791234567), only
 * after a contact word: on its own it could be an amount in centimes.
 */
const CONTACT_NUMBER = new RegExp(
  `(${START}${ARABIC_PREFIX}(?:${CONTACT_WORDS.join('|')})${NOT_DIGIT}{0,20})` +
    `([1-9١-٩۱-۹](?:[\\s.()-]{0,2}${DIGIT}){10,14})${END}${NO_CURRENCY}`,
  'giu',
);

/**
 * A phone number: an international prefix (+ or 00) or a leading 0, then 8 to 14 more digits,
 * optionally split by spaces, dots, dashes or brackets. Amounts ("1500", "1,500,000", "2026")
 * never start with 0 or +, so they are left alone.
 */
const PHONE = new RegExp(
  `${START}(?:\\+|00|0|٠٠|٠|۰۰|۰)(?:[\\s.()-]{0,3}${DIGIT}){8,14}${END}`,
  'gu',
);

const PLACEHOLDER = /\[(?:email|phone|name|link|iban|id)\d{0,3}\]/g;

/** Very short names would match inside ordinary words. */
const MIN_NAME_LENGTH = 3;

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** The text with the founder's identifiers replaced by numbered placeholders. */
export function deidentify(text: string, identity: Identity = {}): DeidentifiedText {
  const originals = new Map<string, string>();
  const tokens = new Map<string, string>();
  const counts = new Map<Kind, number>();

  // The same text always gets the same placeholder, and one the founder typed is never reused.
  const placeholder = (kind: Kind, original: string): string => {
    const known = tokens.get(`${kind}:${original}`);
    if (known) return known;
    let count = counts.get(kind) ?? 0;
    let token: string;
    do {
      count += 1;
      token = `[${kind}${String(count)}]`;
    } while (text.includes(token));
    counts.set(kind, count);
    tokens.set(`${kind}:${original}`, token);
    originals.set(token, original);
    return token;
  };
  const whole = (pattern: RegExp, kind: Kind) => (value: string) =>
    value.replace(pattern, (match) => placeholder(kind, match));
  // Keeps the word before the value (group 1) and replaces the value (group 2).
  const after = (pattern: RegExp, kind: Kind) => (value: string) =>
    value.replace(
      pattern,
      (_match, before: string, found: string) => before + placeholder(kind, found),
    );

  const email = identity.email?.trim();
  // Longest first, so a full name gets one placeholder rather than one per part.
  const names = [...new Set((identity.names ?? []).map((name) => name.trim()))]
    .filter((name) => name.length >= MIN_NAME_LENGTH)
    .sort((a, b) => b.length - a.length);

  const steps = [
    ...(email ? [whole(new RegExp(escapeRegExp(email), 'giu'), 'email')] : []),
    whole(EMAIL, 'email'),
    whole(LINK, 'link'),
    // Before phones: an IBAN or an ID number may contain a run that starts with 0.
    whole(IBAN, 'iban'),
    after(ID_NUMBER, 'id'),
    whole(PHONE, 'phone'),
    after(CONTACT_NUMBER, 'phone'),
    ...names.map((name) =>
      after(new RegExp(`(${START}${ARABIC_PREFIX})(${escapeRegExp(name)})${END}`, 'giu'), 'name'),
    ),
  ];
  const result = steps.reduce((value, step) => step(value), text);
  return { text: result as Deidentified, originals };
}

/** Puts back the text each placeholder stands for. Unknown placeholders are left as they are. */
export function reidentify(text: string, originals: ReadonlyMap<string, string>): string {
  return text.replace(PLACEHOLDER, (token) => originals.get(token) ?? token);
}

/** True when the text still holds a placeholder, numbered or not. */
export function hasPlaceholder(text: string): boolean {
  return new RegExp(PLACEHOLDER.source).test(text);
}

/** A random identifier for one request, in place of the user ID (rule 5). */
export function requestToken(): string {
  return randomUUID();
}
