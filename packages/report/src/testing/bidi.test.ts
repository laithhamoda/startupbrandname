import { describe, expect, it } from 'vitest';
import { assembleLine, foldForMatch, hasRtlLetter, type Piece } from './bidi';

/** Pieces laid out left to right: each starts where the previous one ended, plus a gap. */
function line(...parts: (string | number)[]): Piece[] {
  const pieces: Piece[] = [];
  let x = 50;
  for (const part of parts) {
    if (typeof part === 'number') {
      x += part;
    } else {
      pieces.push({ str: part, x, width: part.length * 5 });
      x += part.length * 5;
    }
  }
  return pieces;
}

describe('assembleLine in a right-to-left line', () => {
  it('reads the pieces from the right and keeps a number whole', () => {
    // Drawn left to right: "أ" "." "د" then 250 on the right.  Read: 250 د.أ
    expect(assembleLine(line('ﺃ', '.', 'ﺩ', ' ', '250'), 'rtl')).toBe('250 د.أ');
  });

  it('keeps the order of a Latin phrase and an address inside Arabic text', () => {
    // Drawn: the two letters of "لا", LTV/CAC, then "ب" on the right.
    const pieces = line('ﺍ', 'ﻞ', ' ', 'LTV/CAC', ' ', 'ﺏ');
    expect(assembleLine(pieces, 'rtl')).toBe('ب LTV/CAC لا');
  });

  it('mirrors a bracket drawn on the left of a Latin word and reads it on the right', () => {
    // Drawn: ( Break-even ) then the Arabic word to its right.
    const pieces = line('(', 'Break-even', ')', ' ', 'ﺏ');
    expect(assembleLine(pieces, 'rtl')).toBe('ب (Break-even)');
  });

  it('does not join the text of two table cells that are far apart', () => {
    // Drawn: DZD  [cell gap]  83,333.33 ; in a right-to-left row the amount comes first.
    const pieces = line('DZD', 40, '83,333.33');
    expect(assembleLine(pieces, 'rtl')).toBe('83,333.33 DZD');
  });

  it('joins pieces of one Latin phrase that are close together', () => {
    expect(assembleLine(line('Y1', ' ', 'Q1'), 'rtl')).toBe('Y1 Q1');
  });

  it('puts a space between pieces with a visible gap but no space of their own', () => {
    expect(assembleLine(line('ﺏ', 3, 'ﺍ'), 'rtl')).toBe('ا ب');
    expect(assembleLine(line('ﺏ', 0.5, 'ﺍ'), 'rtl')).toBe('اب');
  });

  it('turns the lam-alef ligature and the joined forms back into plain letters', () => {
    // U+FEFB is the lam-alef ligature; it is one glyph, so it stays one piece.
    expect(assembleLine(line('ﻻ'), 'rtl')).toBe('لا');
  });

  it('reads a lone line of Latin text in a right-to-left document as written', () => {
    expect(assembleLine(line('1', ' ', '/', ' ', '6'), 'rtl')).toBe('1 / 6');
  });
});

describe('assembleLine in a left-to-right line', () => {
  it('reads Latin text as written', () => {
    expect(assembleLine(line('Executive', ' ', 'summary'), 'ltr')).toBe('Executive summary');
  });

  it('reverses an Arabic run inside English text and leaves the English alone', () => {
    // Drawn left to right: the Arabic run "ب ا" ; read from its right end it is "ا ب".
    const pieces = line('Arabic', ' ', 'text:', ' ', 'ﺏ', ' ', 'ﺍ');
    expect(assembleLine(pieces, 'ltr')).toBe('Arabic text: ا ب');
  });

  it('mirrors a bracket inside an Arabic run', () => {
    // Drawn: ب ( ا between two Arabic letters; read from the right the glyph "(" is a ")".
    expect(assembleLine(line('ﺏ', '(', 'ﺍ'), 'ltr')).toBe('ا)ب');
  });

  it('keeps English that follows an Arabic run after it', () => {
    expect(assembleLine(line('ﺏ', ' ', 'ﺍ', ' ', 'end'), 'ltr')).toBe('ا ب end');
  });
});

describe('helpers', () => {
  it('detects Arabic letters in any form', () => {
    expect(hasRtlLetter('ﻞ')).toBe(true);
    expect(hasRtlLetter('ل')).toBe(true);
    expect(hasRtlLetter('250 JOD')).toBe(false);
  });

  it('folds forms, marks and spaces away for a comparison', () => {
    expect(foldForMatch('ا ﻟ ﺸ ّ ﺮ ﻛ ﺔ')).toBe(foldForMatch('الشركة'));
    expect(foldForMatch('الشَّرِكَةُ')).toBe('الشركة');
    expect(foldForMatch('ولكـــنهم')).toBe('ولكنهم');
  });
});
