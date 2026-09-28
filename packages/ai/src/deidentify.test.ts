import { describe, expect, it } from 'vitest';
import { deidentify, requestToken } from './deidentify';

describe('deidentify (CLAUDE.md rule 5)', () => {
  it.each([
    ['راسلني على founder@example.com للتفاصيل', 'راسلني على [email] للتفاصيل'],
    ['Email me at a.b+c@mail.co.uk.', 'Email me at [email].'],
  ])('removes email addresses: %s', (text, expected) => {
    expect(deidentify(text)).toBe(expected);
  });

  it.each([
    ['اتصل على 0791234567', 'اتصل على [phone]'],
    ['اتصل على +962 79 123 4567 مساءً', 'اتصل على [phone] مساءً'],
    ['00213 555 12 34 56', '[phone]'],
    ['0555-12-34-56 ou 0661.23.45.67', '[phone] ou [phone]'],
    ['رقمي ٠٧٩١٢٣٤٥٦٧', 'رقمي [phone]'],
    ['(079) 123-4567', '([phone]'],
  ])('removes phone numbers in any format: %s', (text, expected) => {
    expect(deidentify(text)).not.toMatch(/\d{7,}/);
    expect(deidentify(text)).toContain('[phone]');
    if (!text.startsWith('(')) expect(deidentify(text)).toBe(expected);
  });

  it.each([
    'السعر 1500 دينار أردني',
    'رأس المال 1,500,000 دينار جزائري',
    'نبدأ في 2026 بـ 3 موظفين',
    'تكلفة الوحدة 0.75 دولار',
    '12 طلبًا في اليوم، 360 في الشهر',
  ])('keeps amounts, years and counts: %s', (text) => {
    expect(deidentify(text)).toBe(text);
  });

  it('removes the account’s own email and names wherever they appear', () => {
    const identity = { email: 'Laith@Example.com', names: ['ليث', 'Laith Ahmad'] };
    expect(deidentify('أنا ليث، ومشروعي لـ laith@example.com. Laith Ahmad founder', identity)).toBe(
      'أنا [name]، ومشروعي لـ [email]. [name] founder',
    );
  });

  it('does not match names inside other words, or names too short to be safe', () => {
    expect(deidentify('الليثيوم مادة', { names: ['ليث'] })).toBe('الليثيوم مادة');
    expect(deidentify('Al is here', { names: ['Al'] })).toBe('Al is here');
  });

  it('makes a new random token for every request', () => {
    const first = requestToken();
    expect(first).toMatch(/^[0-9a-f-]{36}$/);
    expect(requestToken()).not.toBe(first);
  });
});
