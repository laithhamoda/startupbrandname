import { describe, expect, it } from 'vitest';
import { deidentify, hasPlaceholder, reidentify, requestToken } from './deidentify';

const text = (input: string, identity?: Parameters<typeof deidentify>[1]) =>
  deidentify(input, identity).text;

describe('deidentify (CLAUDE.md rule 5)', () => {
  it.each([
    ['راسلني على founder@example.com للتفاصيل', 'راسلني على [email1] للتفاصيل'],
    ['Email me at a.b+c@mail.co.uk.', 'Email me at [email1].'],
    ['بريدي: مؤسس@مثال.شبكة', 'بريدي: [email1]'],
  ])('removes email addresses: %s', (input, expected) => {
    expect(text(input)).toBe(expected);
  });

  it.each([
    ['اتصل على 0791234567', 'اتصل على [phone1]'],
    ['اتصل على +962 79 123 4567 مساءً', 'اتصل على [phone1] مساءً'],
    ['00213 555 12 34 56', '[phone1]'],
    ['0555-12-34-56 ou 0661.23.45.67', '[phone1] ou [phone2]'],
    ['رقمي ٠٧٩١٢٣٤٥٦٧', 'رقمي [phone1]'],
    ['(079) 123-4567', '([phone1]'],
    ['أرقامنا 0791234567 0799999999', 'أرقامنا [phone1] [phone2]'],
    ['عدد الفروع 3\n0791234567', 'عدد الفروع 3\n[phone1]'],
  ])('removes phone numbers in any format: %s', (input, expected) => {
    expect(text(input)).toBe(expected);
  });

  it.each([
    ['واتساب 962791234567', 'واتساب [phone1]'],
    ['call me on 213 555 12 34 56 please', 'call me on [phone1] please'],
    ['جوالي: ٩٦٢٧٩١٢٣٤٥٦٧', 'جوالي: [phone1]'],
    ['وللتواصل اتصلوا بنا على 966501234567', 'وللتواصل اتصلوا بنا على [phone1]'],
    ['هاتفنا 962791234567', 'هاتفنا [phone1]'],
    ['Tel: 962791234567', 'Tel: [phone1]'],
  ])('removes international numbers without a prefix after a contact word: %s', (input, out) => {
    expect(text(input)).toBe(out);
  });

  it.each([
    ['تواصل عبر https://wa.me/962791234567 أو', 'تواصل عبر [link1] أو'],
    ['قناتنا t.me/laith_bakery', 'قناتنا [link1]'],
    ['صفحتنا instagram.com/laith.bakery وفيسبوك', 'صفحتنا [link1] وفيسبوك'],
    ['اتصل tel:+962791234567', 'اتصل [link1]'],
  ])('removes links to a profile or a chat: %s', (input, expected) => {
    expect(text(input)).toBe(expected);
  });

  it.each([
    ['الحساب JO71 CBJO 0010 0000 0000 0131 0003 02 لدى البنك', 'الحساب [iban1] لدى البنك'],
    ['IBAN: DZ580002100001113000000570', 'IBAN: [iban1]'],
    ['GB29 NWBK 6016 1331 9268 19', '[iban1]'],
  ])('removes IBANs: %s', (input, expected) => {
    expect(text(input)).toBe(expected);
  });

  it.each([
    ['الرقم الوطني 9861012345', 'الرقم الوطني [id1]'],
    ['وبرقم الهوية: 1-0987-0123-4567-8901', 'وبرقم الهوية: [id1]'],
    ['NIN: 109870123456789012', 'NIN: [id1]'],
    ['passport no. N1234567890', 'passport no. [id1]'],
  ])('removes ID numbers after an ID word: %s', (input, expected) => {
    expect(text(input)).toBe(expected);
  });

  // A false positive would hide a founder's figure from the review, or part of it, so that a
  // rewrite could lose its first digits (PRIV-2): mandatory cases.
  it.each([
    'السعر 1500 دينار أردني',
    'الميزانية 1 000 000 000 سنتيم',
    'رأس المال 15 000 000 000 دج',
    'رأس المال 15 000 000 000',
    'نحتاج 2.000.000.000 سنتيم',
    'نحتاج 2.000.000.000',
    'التكلفة ١٥ ٠٠٠ ٠٠٠ ٠٠٠ دج',
    'Telecom market 12000000000',
    'Telemedicine market 25000000000 by 2030',
    'contacts reached 12000000000 impressions',
    'قطاع اتصالات 15000000000',
    'اتصالات: السوق 15000000000 سنويا',
    'FY25 plan aims high',
    'FY25 PLAN AIMS HIGH',
    'رأس المال 1,500,000 دينار جزائري',
    'نبدأ في 2026 بـ 3 موظفين',
    'تأسست الشركة سنة 1999',
    'تكلفة الوحدة 0.75 دولار',
    '12 طلبًا في اليوم، 360 في الشهر',
    'رأس المال 2130000000 سنتيم',
    'المبلغ 9620000 دينار',
    'رقم الأعمال 2130000000 سنتيم',
    'المبيعات السنوية 962791234567',
    'هاتف ذكي بسعر 21300000000 سنتيم',
    'الهوية البصرية تكلّف 2130000000 دج',
    'Call volume: 15000000000 dollars a year',
    'نخدم 15% من السوق، أي 962000 أسرة',
    'منافسنا الأول talabat.com والثاني careem.com',
    'الوزن 1.5kg/day والسرعة 60 km/h',
  ])('keeps amounts, years, counts and bare domains: %s', (input) => {
    expect(text(input)).toBe(input);
  });

  it('removes the account’s own email and names wherever they appear', () => {
    const identity = { email: 'Laith@Example.com', names: ['ليث', 'Laith Ahmad', 'Laith'] };
    expect(text('أنا ليث، ومشروعي لـ laith@example.com. Laith Ahmad founder', identity)).toBe(
      'أنا [name2]، ومشروعي لـ [email1]. [name1] founder',
    );
    expect(text('Laith and Ahmad', identity)).toBe('[name1] and Ahmad');
  });

  it('removes a name written with an attached Arabic prefix, and keeps the prefix', () => {
    expect(text('هذا المشروع لليث وفاطمة', { names: ['ليث', 'فاطمة'] })).toBe(
      'هذا المشروع ل[name2] و[name1]',
    );
  });

  it('does not match names inside other words, or names too short to be safe', () => {
    expect(text('الليثيوم مادة', { names: ['ليث'] })).toBe('الليثيوم مادة');
    expect(text('Al is here', { names: ['Al'] })).toBe('Al is here');
    expect(text('nothing to hide', { names: [] })).toBe('nothing to hide');
  });

  it('gives the same text the same placeholder, and different texts their own', () => {
    expect(text('0791234567 ثم 0791234567 ثم 0799999999')).toBe('[phone1] ثم [phone1] ثم [phone2]');
  });

  it('never reuses a placeholder the founder typed', () => {
    expect(text('اكتب [phone1] هنا: 0791234567')).toBe('اكتب [phone1] هنا: [phone2]');
  });

  it('runs in bounded time on the worst inputs (CodeQL js/polynomial-redos)', () => {
    const inputs = [
      `${'%'.repeat(4000)} founder@example.com`,
      `${'a'.repeat(3990)}@example`,
      `a@${'a.'.repeat(1998)}`,
      `0${' '.repeat(3999)}`,
      `${'a.'.repeat(1990)}com/`,
      `JO12${' 1234'.repeat(799)}`,
      `الرقم الوطني ${'1 '.repeat(1990)}`,
      `اتصل ${'9.'.repeat(1995)}`,
      `tel:${'('.repeat(3996)}`,
      '1 000 '.repeat(666),
      '0 '.repeat(2000),
      `JO12${' ABCD'.repeat(799)}`,
    ];
    for (const input of inputs) {
      const started = performance.now();
      deidentify(input, { email: 'x@example.com', names: ['ليث', 'Laith'] });
      expect(performance.now() - started, input.slice(0, 20)).toBeLessThan(250);
    }
    expect(text(inputs[0] ?? '')).toBe(`${'%'.repeat(4000)} [email1]`);
  });
});

describe('reidentify', () => {
  it('puts the founder’s own text back, exactly as typed', () => {
    const input =
      'أنا ليث، واتساب ٩٦٢٧٩١٢٣٤٥٦٧ و founder@example.com وصفحتي instagram.com/laith.bakery';
    const { text: hidden, originals } = deidentify(input, { names: ['ليث'] });
    expect(hidden).not.toMatch(/ليث|٩٦٢|founder|instagram/);
    expect(reidentify(hidden, originals)).toBe(input);
  });

  it('restores placeholders the model kept or moved, and leaves unknown ones', () => {
    const { originals } = deidentify('اتصل على 0791234567');
    expect(reidentify('يمكن الاتصال على [phone1] و[phone7]', originals)).toBe(
      'يمكن الاتصال على 0791234567 و[phone7]',
    );
  });

  it('tells whether a text still holds a placeholder', () => {
    expect(hasPlaceholder('رقمي [phone]')).toBe(true);
    expect(hasPlaceholder('رقمي [phone12]')).toBe(true);
    expect(hasPlaceholder('[iban1] و[id2] و[link3] و[name4] و[email5]')).toBe(true);
    expect(hasPlaceholder('ملاحظة [note] و[1]')).toBe(false);
  });
});

describe('requestToken', () => {
  it('makes a new random token for every request', () => {
    const first = requestToken();
    expect(first).toMatch(/^[0-9a-f-]{36}$/);
    expect(requestToken()).not.toBe(first);
  });
});
