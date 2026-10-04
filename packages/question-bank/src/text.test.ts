import { describe, expect, it } from 'vitest';
import { containsPhrase, findPhrases, fold, sentenceCount, wordCount } from './text';
import { numberText, readNumber, rangeValue, westernDigits } from './numbers';

describe('fold', () => {
  it('unifies hamza carriers, alif maqsura, ta marbuta and diacritics', () => {
    expect(fold('أُسرةٌ إِلى آخِر مستوى')).toBe(fold('اسره الي اخر مستوي'));
    expect(fold('مسؤول ومسئول')).toBe('مسوول ومسيول');
  });

  it('drops tatweel, Latin accents, case and punctuation', () => {
    expect(fold('الـــجميع!')).toBe('الجميع');
    expect(fold('Qualité, TOUT le monde.')).toBe('qualite tout le monde');
  });
});

describe('phrases', () => {
  it('match whole words only', () => {
    expect(containsPhrase('العميل هو الجميع', ['الجميع'])).toBe(true);
    expect(containsPhrase('للجميعات', ['الجميع'])).toBe(false);
    expect(containsPhrase("I don't know", ['i don t know'])).toBe(true);
  });

  it('are listed in the order given', () => {
    expect(findPhrases('دينار أو ريال', ['ريال', 'دينار', 'جنيه'])).toEqual(['ريال', 'دينار']);
  });
});

describe('counts', () => {
  it('count words after folding', () => {
    expect(wordCount('')).toBe(0);
    expect(wordCount('  خدمة صيانة، للمطاعم  ')).toBe(3);
  });

  it('count sentences by their end marks', () => {
    expect(sentenceCount('جملة واحدة.')).toBe(1);
    expect(sentenceCount('الأولى. الثانية؟ الثالثة')).toBe(3);
    expect(sentenceCount('One sentence without a stop')).toBe(1);
  });
});

describe('readNumber', () => {
  // Each form in Western and in Arabic-Indic digits: founders type both (CLAUDE.md §3).
  it.each([
    // Forms read before this table existed: still read the same way.
    ['1500', 1500],
    ['١٥٠٠', 1500],
    ['١٬٥٠٠', 1500],
    ['٢٫٥', 2.5],
    ['۳۰', 30],
    ['12.5', 12.5],
    ['١٢.٥', 12.5],
    ['1,500,000', 1_500_000],
    ['١,٥٠٠,٠٠٠', 1_500_000],
    ['1,500.25', 1500.25],
    ['1.5 مليون', 1_500_000],
    ['١٫٥ مليون', 1_500_000],
    ['2k', 2000],
    ['3 آلاف', 3000],
    ['٣ الاف دينار', 3000],
    ['2 مليار', 2_000_000_000],
    ['2 million', 2_000_000],
    ['٥ ألف', 5000],
    ['3 milliards', 3_000_000_000],
    ['٢ مليون دج', 2_000_000],
    ['حوالي 40 ساعة', 40],
    ['250 د.أ', 250],
    ['20%', 20],
    // Thousands grouped by spaces, as in French (UX-2).
    ['1 500', 1500],
    ['١ ٥٠٠', 1500],
    ['1\u00A0500', 1500],
    ['1\u202F500 000', 1_500_000],
    ['1 500 000 دج', 1_500_000],
    // Thousands grouped by dots, two groups or more.
    ['1.500.000', 1_500_000],
    ['١.٥٠٠.٠٠٠', 1_500_000],
    // A decimal comma, with one or two digits.
    ['12,5', 12.5],
    ['١٢,٥', 12.5],
    ['12,50', 12.5],
    ['2,5 مليون', 2_500_000],
    ['1.500,25', 1500.25],
    ['1 500,25', 1500.25],
    ['0,500', 0.5],
    ['0.500', 0.5],
    ['1500.000', 1500],
    // Scales are exact: no floating-point remainder.
    ['1.1k', 1100],
    ['0,3 مليون', 300_000],
    ['-5', -5],
    ['−5', -5],
    // Units that are not scales.
    ['20 min', 20],
    ['40 hours', 40],
    ['5 MB', 5],
    ['3h', 3],
  ])('reads %s as %d', (text, value) => {
    expect(readNumber(text)).toEqual({ ok: true, value });
  });

  it.each([
    ['1.500', 1500, 1.5],
    ['١.٥٠٠', 1500, 1.5],
    ['1,500', 1500, 1.5],
    ['١,٥٠٠', 1500, 1.5],
    ['12,500', 12_500, 12.5],
  ])('asks which reading "%s" has: %d or %d', (text, grouped, decimal) => {
    const reading = readNumber(text);
    expect(reading).toMatchObject({ ok: false, reason: 'two_readings', typed: text });
    if (reading.ok || reading.reason !== 'two_readings') return;
    expect(reading.readings.map((alternative) => alternative.value)).toEqual([grouped, decimal]);
  });

  it('gives each reading back as a text with only that reading', () => {
    expect(readNumber('حوالي ١.٥٠٠ مليون دج')).toEqual({
      ok: false,
      reason: 'two_readings',
      typed: '١.٥٠٠',
      readings: [
        { value: 1_500_000_000, number: '1500', text: 'حوالي 1500 مليون دج' },
        { value: 1_500_000, number: '1.5', text: 'حوالي 1.5 مليون دج' },
      ],
    });
    for (const alternative of [
      { text: '1500', value: 1500 },
      { text: '1.5', value: 1.5 },
    ]) {
      expect(readNumber(alternative.text)).toEqual({ ok: true, value: alternative.value });
    }
  });

  it.each([
    '1.500',
    '1,500',
    '12.125',
    '2,375',
    '33.333',
    '999.999',
    '١٢.١٢٥',
    '-12.125',
    '1.125 مليون',
    'حوالي 2,375 دج',
  ])('reads each reading of "%s" back as itself, so a pick is saved', (text) => {
    const reading = readNumber(text);
    if (reading.ok || reading.reason !== 'two_readings') throw new Error(`${text}: one reading`);
    for (const alternative of reading.readings) {
      expect(readNumber(alternative.text), alternative.text).toEqual({
        ok: true,
        value: alternative.value,
      });
    }
  });

  it('writes a decimal reading of three digits with a trailing zero', () => {
    const reading = readNumber('12.125');
    expect(reading).toMatchObject({
      readings: [
        { value: 12_125, number: '12125', text: '12125' },
        { value: 12.125, number: '12.125', text: '12.1250' },
      ],
    });
  });

  it.each([
    12.125, 33.333, 33.334, 1.125, 999.999, 0.125, 1500.125, 12.5, 1500, 2_000_000, -12.125,
  ])('writes %d as a text read back as itself', (value) => {
    expect(readNumber(numberText(value))).toEqual({ ok: true, value });
  });

  it.each([
    '12 5',
    '15 00',
    '1,5000',
    '1500,000',
    '1.5.3',
    '1,5.25',
    '1 500.000',
    '1٫5٫3',
    '.5',
    '3 محلات و 5 موظفين',
    '5 أو 6',
    '10/20',
    '+962 79 000 0000',
    'مليون و500',
    'ألف و ٥٠٠',
    // A dash that is not a minus joined to the digits: a list bullet or a slip.
    '- 5',
    '− ٥',
    '–5',
    '— 5',
  ])('never reads only part of "%s"', (text) => {
    expect(readNumber(text)).toEqual({ ok: false, reason: 'ambiguous' });
  });

  it('does not guess a range or words without digits', () => {
    expect(readNumber('200-300')).toEqual({ ok: false, reason: 'range' });
    expect(readNumber('١٠-٢٠')).toEqual({ ok: false, reason: 'range' });
    expect(readNumber('1,500 - 2,000')).toEqual({ ok: false, reason: 'range' });
    expect(readNumber('من 5 إلى 10')).toEqual({ ok: false, reason: 'range' });
    expect(readNumber('خمسين')).toEqual({ ok: false, reason: 'not_a_number' });
    expect(readNumber('1'.repeat(400))).toEqual({ ok: false, reason: 'not_a_number' });
    expect(readNumber('   ')).toEqual({ ok: false, reason: 'empty' });
  });

  it.each(['1.5M', '2m', '20 m', '٢٠ M', '3B', '3 b'])(
    'asks about "%s": a lone m or b is a million or a billion, or metres or minutes',
    (text) => {
      expect(readNumber(text)).toEqual({ ok: false, reason: 'ambiguous' });
    },
  );

  it('turns Arabic-Indic and Persian digits into Western ones', () => {
    expect(westernDigits('٠١٢٣٤٥٦٧٨٩ ۰۱۲')).toBe('0123456789 012');
  });

  it('stores the middle of a picked range, or its floor when open-ended', () => {
    expect(rangeValue({ min: 10, max: 20 }, false)).toBe(15);
    expect(rangeValue({ min: 40 }, false)).toBe(40);
    expect(rangeValue({ min: 1, max: 2 }, false)).toBe(1.5);
  });

  it('stores a whole number for a whole-number question (UX-1)', () => {
    expect(rangeValue({ min: 1, max: 2 }, true)).toBe(2);
    expect(rangeValue({ min: 21, max: 50 }, true)).toBe(36);
    expect(rangeValue({ min: 0, max: 0 }, true)).toBe(0);
  });
});
