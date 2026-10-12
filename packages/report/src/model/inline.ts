import type { Inline, Part } from './types';

/** A number or an amount's digits as one part: Western digits, separators and a sign. */
export const num = (text: string): Inline => [{ n: text }];

/** A fragment that reads left to right: a URL, a currency code, an engine tag. */
export const ltr = (text: string): Inline => [{ l: text }];

/** Plain text from a person or a catalog; an empty string gives no part. */
export const plain = (text: string): Inline => (text === '' ? [] : [text]);

/** Joins adjacent plain strings and drops empty ones, so a model stays small and comparable. */
export function normalise(parts: readonly Part[]): Inline {
  const out: Part[] = [];
  for (const part of parts) {
    if (typeof part === 'string') {
      if (part === '') continue;
      const last = out[out.length - 1];
      if (typeof last === 'string') out[out.length - 1] = last + part;
      else out.push(part);
    } else {
      out.push(part);
    }
  }
  return out;
}

/** Puts several phrases in a row with a plain separator between them. */
export function join(items: readonly Inline[], separator: string): Inline {
  const parts: Part[] = [];
  items.forEach((item, index) => {
    if (index > 0) parts.push(separator);
    parts.push(...item);
  });
  return normalise(parts);
}

/** Writes phrases one after another with no separator. */
export function concat(...items: readonly Inline[]): Inline {
  return normalise(items.flat());
}

/**
 * Builds a sentence from fixed text and slots: `inl\`... ${slot} ...\``. The fixed text of a
 * message never holds a digit, so every number enters through a slot (CLAUDE.md rule 1, D-270).
 */
export function inl(strings: TemplateStringsArray, ...slots: readonly Inline[]): Inline {
  const parts: Part[] = [];
  strings.forEach((text, index) => {
    parts.push(text);
    const slot = slots[index];
    if (slot !== undefined) parts.push(...slot);
  });
  return normalise(parts);
}

/** The text of an inline with the numbers and fragments written as they are: for tests and logs. */
export function inlineText(inline: Inline): string {
  return inline
    .map((part) => {
      if (typeof part === 'string') return part;
      return 'n' in part ? part.n : part.l;
    })
    .join('');
}
