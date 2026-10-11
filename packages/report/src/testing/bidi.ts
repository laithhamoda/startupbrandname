/**
 * From the pieces of text a PDF stores to the text a person reads (test support, D-241).
 *
 * Chromium writes a line the way it is drawn: left to right, with Arabic in its joined
 * presentation forms (U+FE70 to U+FEFC). So the pieces of one line come in visual order, and an
 * Arabic sentence comes out backwards. pdf.js hands each piece back with its own letters already
 * in reading order (a piece never mixes scripts: Arabic and Latin text use different fonts).
 * assembleLine() puts the pieces of one line in reading order: right-to-left parts reversed,
 * numbers and Latin words kept in order, brackets mirrored, letters normalized (NFKC turns the
 * lam-alef ligature back into two letters).
 */

export type BaseDirection = 'rtl' | 'ltr';

/** A piece of text as pdf.js reports it: the string, where it starts and how wide it is. */
export interface Piece {
  str: string;
  /** Points from the left edge of the page. */
  x: number;
  width: number;
}

/** A gap wider than this (points) between two pieces is a table cell, not a word space. */
export const CELL_GAP_POINTS = 8;
/** A gap wider than this (points) is a space when neither piece brings one. */
export const WORD_GAP_POINTS = 1.2;

const MIRRORS: Readonly<Record<string, string>> = {
  '(': ')',
  ')': '(',
  '[': ']',
  ']': '[',
  '{': '}',
  '}': '{',
  '<': '>',
  '>': '<',
  '«': '»',
  '»': '«',
};

const RTL_LETTER = /[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFC]/;
const LATIN_OR_DIGIT = /[A-Za-z0-9\u00C0-\u024F]/;

export const hasRtlLetter = (text: string): boolean => RTL_LETTER.test(text);

type Kind = 'rtl' | 'ltr' | 'neutral' | 'barrier';

interface Token {
  str: string;
  kind: Kind;
}

function kindOf(str: string): Kind {
  if (RTL_LETTER.test(str)) return 'rtl';
  return LATIN_OR_DIGIT.test(str) ? 'ltr' : 'neutral';
}

/** The pieces in drawing order, with a space or a cell barrier where the gap says so. */
function tokenize(pieces: readonly Piece[]): Token[] {
  const tokens: Token[] = [];
  let end = Number.NEGATIVE_INFINITY;
  for (const piece of [...pieces].sort((a, b) => a.x - b.x)) {
    const gap = piece.x - end;
    const previous = tokens.at(-1);
    if (previous) {
      if (gap > CELL_GAP_POINTS) tokens.push({ str: ' ', kind: 'barrier' });
      else if (gap > WORD_GAP_POINTS && !previous.str.endsWith(' ') && !piece.str.startsWith(' ')) {
        tokens.push({ str: ' ', kind: 'neutral' });
      }
    }
    tokens.push({ str: piece.str, kind: kindOf(piece.str) });
    end = piece.x + piece.width;
  }
  return tokens;
}

/**
 * Cuts the tokens into [tokens, island] runs. An island is a run of `strong` tokens, with the
 * neutral tokens (spaces, punctuation) between two of them; a barrier ends it.
 */
function cut(tokens: readonly Token[], strong: Kind): { tokens: Token[]; island: boolean }[] {
  const runs: { tokens: Token[]; island: boolean }[] = [];
  let outside: Token[] = [];
  const flush = (): void => {
    if (outside.length > 0) runs.push({ tokens: outside, island: false });
    outside = [];
  };
  let index = 0;
  while (index < tokens.length) {
    const token = tokens[index];
    if (token?.kind !== strong) {
      if (token) outside.push(token);
      index += 1;
      continue;
    }
    flush();
    let end = index + 1;
    let cursor = end;
    while (cursor < tokens.length) {
      const kind = tokens[cursor]?.kind;
      if (kind === strong) {
        end = cursor + 1;
        cursor += 1;
      } else if (kind === 'neutral') {
        let next = cursor;
        while (tokens[next]?.kind === 'neutral') next += 1;
        if (tokens[next]?.kind !== strong) break;
        cursor = next;
      } else {
        break;
      }
    }
    runs.push({ tokens: tokens.slice(index, end), island: true });
    index = end;
  }
  flush();
  return runs;
}

/** A neutral piece drawn in a right-to-left run: reversed, and its brackets mirrored. */
function readNeutral(token: Token): string {
  return Array.from(token.str)
    .reverse()
    .map((character) => MIRRORS[character] ?? character)
    .join('');
}

/** The tokens of a run read from their right end. */
function readFromRight(tokens: readonly Token[]): string {
  return [...tokens]
    .reverse()
    .map((token) => (token.kind === 'neutral' ? readNeutral(token) : token.str))
    .join('');
}

const readFromLeft = (tokens: readonly Token[]): string =>
  tokens.map((token) => token.str).join('');

/**
 * One line of a page, in reading order. `base` is the direction of the line: rtl for an Arabic
 * paragraph, ltr for an English one. A line that mixes scripts is read as the standard bidi
 * algorithm would show it.
 */
export function assembleLine(pieces: readonly Piece[], base: BaseDirection): string {
  const runs = cut(tokenize(pieces), base === 'rtl' ? 'ltr' : 'rtl');
  const read =
    base === 'rtl'
      ? // From the right: the runs go in reverse; Latin and numbers keep their own order.
        [...runs]
          .reverse()
          .map((run) => (run.island ? readFromLeft(run.tokens) : readFromRight(run.tokens)))
      : // From the left: only an Arabic run is read from its right end.
        runs.map((run) => (run.island ? readFromRight(run.tokens) : readFromLeft(run.tokens)));
  return read.join('').replace(/\s+/gu, ' ').normalize('NFKC');
}

// Nonspacing marks (the tashkeel and the shadda) and the tatweel.
const TASHKEEL_AND_TATWEEL = /[\p{Mn}\u0640]/gu;

/** For comparing: compatibility forms folded, marks and whitespace removed. */
export function foldForMatch(text: string): string {
  return text.normalize('NFKC').replace(TASHKEEL_AND_TATWEEL, '').replace(/\s+/gu, '');
}
