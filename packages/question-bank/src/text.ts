/**
 * Folds text for matching: every combining mark removed after compatibility decomposition (Arabic
 * diacritics and hamza carriers, so أ إ آ ؤ ئ become ا ا ا و ي; Latin accents, so é becomes e),
 * tatweel removed, ٱ → ا, ى → ي, ة → ه, lower case, punctuation turned into spaces. Used only to
 * find phrases; the founder's text itself is always stored as written.
 */
export function fold(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/ـ/g, '')
    .replace(/ٱ/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/** True when the folded text contains one of the phrases as whole words. */
export function containsPhrase(text: string, phrases: readonly string[]): boolean {
  const haystack = ` ${fold(text)} `;
  return phrases.some((phrase) => haystack.includes(` ${fold(phrase)} `));
}

/** The phrases found in the text, in the order of the list. */
export function findPhrases(text: string, phrases: readonly string[]): string[] {
  const haystack = ` ${fold(text)} `;
  return phrases.filter((phrase) => haystack.includes(` ${fold(phrase)} `));
}

export function wordCount(text: string): number {
  const folded = fold(text);
  return folded === '' ? 0 : folded.split(' ').length;
}

/** Counts sentences by their end marks (. ! ? ؟ and the Arabic full stop), ignoring a trailing one. */
export function sentenceCount(text: string): number {
  const parts = text
    .trim()
    .split(/[.!?؟۔]+/)
    .map((part) => part.trim())
    .filter((part) => part !== '');
  return parts.length;
}
