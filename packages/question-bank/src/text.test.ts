import { describe, expect, it } from 'vitest';
import { containsPhrase, findPhrases, fold, sentenceCount, wordCount } from './text';
import { readNumber, rangeValue, westernDigits } from './numbers';

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
  it.each([
    ['1500', 1500],
    ['1,500', 1500],
    ['١٥٠٠', 1500],
    ['١٬٥٠٠', 1500],
    ['٢٫٥', 2.5],
    ['۳۰', 30],
    ['1.5 مليون', 1_500_000],
    ['2k', 2000],
    ['3 آلاف', 3000],
    ['٣ الاف دينار', 3000],
    ['2 مليار', 2_000_000_000],
    ['حوالي 40 ساعة', 40],
  ])('reads %s as %d', (text, value) => {
    expect(readNumber(text)).toEqual({ ok: true, value });
  });

  it('does not guess a range or words without digits', () => {
    expect(readNumber('200-300')).toEqual({ ok: false, reason: 'range' });
    expect(readNumber('من 5 إلى 10')).toEqual({ ok: false, reason: 'range' });
    expect(readNumber('خمسين')).toEqual({ ok: false, reason: 'not_a_number' });
    expect(readNumber('   ')).toEqual({ ok: false, reason: 'empty' });
  });

  it('keeps metres and minutes apart from millions', () => {
    expect(readNumber('20 m')).toEqual({ ok: true, value: 20 });
  });

  it('turns Arabic-Indic and Persian digits into Western ones', () => {
    expect(westernDigits('٠١٢٣٤٥٦٧٨٩ ۰۱۲')).toBe('0123456789 012');
  });

  it('stores the middle of a picked range, or its floor when open-ended', () => {
    expect(rangeValue({ min: 10, max: 20 })).toBe(15);
    expect(rangeValue({ min: 40 })).toBe(40);
  });
});
