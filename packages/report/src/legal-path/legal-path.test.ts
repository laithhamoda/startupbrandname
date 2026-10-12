import type { Answer, Answers } from '@sbn/question-bank';
import { describe, expect, it } from 'vitest';
import {
  officialLinks,
  PACK_KEYS,
  PACK_STALE_AFTER_DAYS,
  packItemSchema,
  packLabel,
  packValueSchema,
  registrationGuide,
  isIsoDate,
  type PackItem,
  type PackKey,
  type PackStatus,
} from './index';

const TODAY = '2026-10-12';

const answered = (value: unknown): Answer => ({ status: 'answered', value });

function item(
  countryCode: string,
  key: string,
  changes: Partial<Pick<PackItem, 'status' | 'lastVerified'>> = {},
): PackItem {
  return {
    countryCode,
    key,
    value: {
      name: { ar: 'اسم', en: 'Name' },
      description: { ar: 'وصف', en: 'Description' },
      url: 'https://example.gov.jo/page',
    },
    sourceUrl: 'https://example.gov.jo/page',
    lastVerified: '2026-10-12',
    status: 'verified',
    ...changes,
  };
}

const JO_KEYS: PackKey[] = [
  PACK_KEYS.soleRegistration,
  PACK_KEYS.companyRegistration,
  PACK_KEYS.chamberMembership,
  PACK_KEYS.foodApproval,
  PACK_KEYS.cosmeticsApproval,
  PACK_KEYS.vocationalLicence,
  PACK_KEYS.homeBusinessAmman,
  PACK_KEYS.taxRegistration,
  PACK_KEYS.socialSecurity,
  PACK_KEYS.taxAuthority,
];
const DZ_KEYS: PackKey[] = [
  PACK_KEYS.autoEntrepreneur,
  PACK_KEYS.autoEntrepreneurActivityList,
  PACK_KEYS.microImport,
  PACK_KEYS.microImportLimits,
  PACK_KEYS.ifuRateCeiling,
  PACK_KEYS.commercialRegister,
  PACK_KEYS.socialSecurity,
  PACK_KEYS.taxRegistration,
  PACK_KEYS.taxAuthority,
];
const JO_ITEMS = JO_KEYS.map((key) => item('JO', key));
const DZ_ITEMS = DZ_KEYS.map((key) => item('DZ', key));
const ALL_ITEMS = [...JO_ITEMS, ...DZ_ITEMS];

const stepKeys = (country: string, answers: Answers, items = ALL_ITEMS) =>
  registrationGuide({ country, answers, items, today: TODAY }).steps.map((step) => step.key);

describe('packLabel', () => {
  it('is null for a verified item checked today', () => {
    expect(packLabel({ status: 'verified', lastVerified: TODAY }, TODAY)).toBeNull();
  });

  it('is null at exactly 90 days and set at 91 (rule 8)', () => {
    expect(PACK_STALE_AFTER_DAYS).toBe(90);
    expect(packLabel({ status: 'verified', lastVerified: '2026-07-14' }, TODAY)).toBeNull();
    expect(packLabel({ status: 'verified', lastVerified: '2026-07-13' }, TODAY)).toBe(
      'verify_official_source',
    );
  });

  it('counts across a leap day', () => {
    expect(packLabel({ status: 'verified', lastVerified: '2024-02-29' }, '2024-05-29')).toBeNull();
    expect(packLabel({ status: 'verified', lastVerified: '2024-02-29' }, '2024-05-30')).toBe(
      'verify_official_source',
    );
  });

  it('is set when the date is missing or malformed', () => {
    expect(packLabel({ status: 'verified', lastVerified: null }, TODAY)).toBe(
      'verify_official_source',
    );
    expect(packLabel({ status: 'verified', lastVerified: '2026-02-30' }, TODAY)).toBe(
      'verify_official_source',
    );
  });

  it('is set for every status but verified, however fresh', () => {
    const statuses: PackStatus[] = ['unverified', 'under_review', 'stale'];
    for (const status of statuses) {
      expect(packLabel({ status, lastVerified: TODAY }, TODAY)).toBe('verify_official_source');
    }
  });

  it('does not set the label for a date in the future', () => {
    expect(packLabel({ status: 'verified', lastVerified: '2026-12-01' }, TODAY)).toBeNull();
  });

  it('refuses a today that is not a date', () => {
    expect(() => packLabel({ status: 'verified', lastVerified: TODAY }, 'tomorrow')).toThrow();
  });
});

describe('isIsoDate', () => {
  it('accepts real days only', () => {
    expect(isIsoDate('2026-10-12')).toBe(true);
    expect(isIsoDate('2026-13-01')).toBe(false);
    expect(isIsoDate('2026-1-12')).toBe(false);
    expect(isIsoDate('2026/10/12')).toBe(false);
    expect(isIsoDate('20x6-10-12')).toBe(false);
    expect(isIsoDate('')).toBe(false);
  });
});

describe('registrationGuide, Jordan', () => {
  const sole = answered({ items: [] });

  it('gives the always steps, in order, for a plain project', () => {
    expect(stepKeys('JO', {})).toEqual([
      'jo.sole',
      'jo.chamber',
      'jo.vocational',
      'jo.tax',
      'jo.social_security',
    ]);
  });

  it('adds the home licence only for E6 home and Amman together', () => {
    const amman = { country: 'JO', city: 'عمّان' };
    expect(stepKeys('JO', { E6: answered('home'), A1: answered(amman) })).toContain(
      'jo.home_business',
    );
    expect(
      stepKeys('JO', { E6: answered('home'), A1: answered({ country: 'JO', city: 'Amman' }) }),
    ).toContain('jo.home_business');
    expect(
      stepKeys('JO', { E6: answered('home'), A1: answered({ country: 'JO', city: 'Irbid' }) }),
    ).not.toContain('jo.home_business');
    expect(stepKeys('JO', { E6: answered('shop'), A1: answered(amman) })).not.toContain(
      'jo.home_business',
    );
    expect(stepKeys('JO', { E6: answered('home'), A1: { status: 'unknown' } })).not.toContain(
      'jo.home_business',
    );
  });

  it('reads the city by words, not by letters inside a word', () => {
    const city = (name: string) =>
      stepKeys('JO', { E6: answered('home'), A1: answered({ country: 'JO', city: name }) });
    expect(city('Amman, Jabal Hussein')).toContain('jo.home_business');
    expect(city('عمّان - الجبيهة')).toContain('jo.home_business');
    expect(city('Ammanford')).not.toContain('jo.home_business');
  });

  it('compares sole and company when A4 names a partner', () => {
    const withPartner = answered({ items: [{ name: 'شريك', detail: 'مسؤول عن الإنتاج' }] });
    expect(stepKeys('JO', { A4: withPartner })).toEqual([
      'jo.sole',
      'jo.company',
      'jo.chamber',
      'jo.vocational',
      'jo.tax',
      'jo.social_security',
    ]);
    expect(stepKeys('JO', { A4: answered({ items: [{ name: 'Business partner' }] }) })).toContain(
      'jo.company',
    );
    expect(
      stepKeys('JO', { A4: answered({ items: [{ name: 'Designer', detail: 'Co-founder' }] }) }),
    ).toContain('jo.company');
  });

  it('does not compare when A4 is empty, unanswered or lists only staff', () => {
    expect(stepKeys('JO', { A4: sole })).not.toContain('jo.company');
    expect(stepKeys('JO', { A4: { status: 'unknown' } })).not.toContain('jo.company');
    expect(stepKeys('JO', { A4: answered({ items: [{ name: 'محاسب' }] }) })).not.toContain(
      'jo.company',
    );
  });

  it('decides food and cosmetics from D2, never from B7', () => {
    const b7 = answered('food');
    expect(stepKeys('JO', { B7: b7 })).not.toContain('jo.food_approval');
    expect(stepKeys('JO', { D2: answered('I') })).toContain('jo.food_approval');
    expect(stepKeys('JO', { D2: answered('I') })).not.toContain('jo.cosmetics_approval');
    const manufacturing = stepKeys('JO', { D2: answered('C') });
    expect(manufacturing).toContain('jo.food_approval');
    expect(manufacturing).toContain('jo.cosmetics_approval');
    expect(stepKeys('JO', { D2: answered('J') })).not.toContain('jo.food_approval');
    expect(stepKeys('JO', { D2: { status: 'unknown' } })).not.toContain('jo.cosmetics_approval');
  });

  it('puts the sector approvals before the vocational licence', () => {
    const keys = stepKeys('JO', { D2: answered('C') });
    expect(keys.indexOf('jo.food_approval')).toBeLessThan(keys.indexOf('jo.vocational'));
  });
});

describe('registrationGuide, Algeria', () => {
  it('shows the auto-entrepreneur path first, then the register as the alternative', () => {
    const guide = registrationGuide({ country: 'DZ', answers: {}, items: ALL_ITEMS, today: TODAY });
    expect(guide.hasPack).toBe(true);
    expect(guide.steps.map((step) => [step.key, step.role])).toEqual([
      ['dz.auto_entrepreneur', 'path'],
      ['dz.activity_list', 'confirm'],
      ['dz.ceiling', 'condition'],
      ['dz.commercial_register', 'alternative'],
      ['dz.social_security', 'always'],
      ['dz.tax', 'always'],
    ]);
  });

  it('rests the ceiling step on the IFU item and the activity step on the official list', () => {
    const guide = registrationGuide({ country: 'DZ', answers: {}, items: ALL_ITEMS, today: TODAY });
    const byKey = Object.fromEntries(guide.steps.map((step) => [step.key, step.itemKey]));
    expect(byKey['dz.ceiling']).toBe('tax.ifu.auto_entrepreneur.rate_ceiling');
    expect(byKey['dz.activity_list']).toBe('registration.auto_entrepreneur.activity_list');
  });

  it('adds the micro-import notes when D6 says yes', () => {
    const yes = answered({ answer: true, percent: 40 });
    const keys = stepKeys('DZ', { D6: yes });
    expect(keys).toContain('dz.micro_import');
    expect(keys).toContain('dz.micro_import_limits');
    expect(keys.indexOf('dz.micro_import')).toBeLessThan(keys.indexOf('dz.commercial_register'));
    expect(stepKeys('DZ', { D6: answered({ answer: false }) })).not.toContain('dz.micro_import');
    expect(stepKeys('DZ', { D6: { status: 'unknown' } })).not.toContain('dz.micro_import');
  });

  it('ignores the Jordan-only answers', () => {
    const keys = stepKeys('DZ', {
      D2: answered('C'),
      E6: answered('home'),
      A1: answered({ country: 'DZ', city: 'Amman' }),
    });
    expect(keys.some((key) => key.startsWith('jo.'))).toBe(false);
  });
});

describe('registrationGuide, labels and gaps', () => {
  it('labels a step by its item', () => {
    const items = JO_ITEMS.map((entry) =>
      entry.key === PACK_KEYS.vocationalLicence
        ? { ...entry, status: 'under_review' as const }
        : entry,
    );
    const guide = registrationGuide({ country: 'JO', answers: {}, items, today: TODAY });
    const labels = Object.fromEntries(guide.steps.map((step) => [step.key, step.label]));
    expect(labels['jo.vocational']).toBe('verify_official_source');
    expect(labels['jo.sole']).toBeNull();
  });

  it('reports a wanted key the pack does not hold, and leaves the step out', () => {
    const items = JO_ITEMS.filter((entry) => entry.key !== PACK_KEYS.socialSecurity);
    const guide = registrationGuide({ country: 'JO', answers: {}, items, today: TODAY });
    expect(guide.missing).toEqual([PACK_KEYS.socialSecurity]);
    expect(guide.steps.map((step) => step.key)).not.toContain('jo.social_security');
  });

  it('gives an empty guide and hasPack false for a country with no pack', () => {
    expect(
      registrationGuide({ country: 'FR', answers: {}, items: ALL_ITEMS, today: TODAY }),
    ).toEqual({
      hasPack: false,
      country: 'FR',
      steps: [],
      missing: [],
    });
  });

  it('gives an empty guide for no items at all, and takes a lower-case country', () => {
    expect(registrationGuide({ country: 'jo', answers: {}, items: [], today: TODAY }).hasPack).toBe(
      false,
    );
    expect(
      registrationGuide({ country: 'jo', answers: {}, items: ALL_ITEMS, today: TODAY }).hasPack,
    ).toBe(true);
  });

  it('does not mix the items of the two countries', () => {
    const guide = registrationGuide({ country: 'JO', answers: {}, items: ALL_ITEMS, today: TODAY });
    expect(guide.steps.every((step) => step.item.countryCode === 'JO')).toBe(true);
  });
});

describe('officialLinks', () => {
  it('returns the tax authority link with its name and label code', () => {
    const link = officialLinks('JO', ALL_ITEMS, TODAY);
    expect(link).toEqual({
      url: 'https://example.gov.jo/page',
      name: { ar: 'اسم', en: 'Name' },
      label: null,
    });
  });

  it('carries the label when the item is not verified', () => {
    const items = [item('DZ', PACK_KEYS.taxAuthority, { status: 'stale' })];
    expect(officialLinks('dz', items, TODAY)?.label).toBe('verify_official_source');
  });

  it('is null when the item or its link is missing, never an invented one', () => {
    expect(officialLinks('FR', ALL_ITEMS, TODAY)).toBeNull();
    expect(officialLinks('JO', [], TODAY)).toBeNull();
    const noUrl = item('JO', PACK_KEYS.taxAuthority);
    const value = { name: noUrl.value.name, description: noUrl.value.description };
    expect(officialLinks('JO', [{ ...noUrl, value }], TODAY)).toBeNull();
  });
});

describe('schemas', () => {
  const evidence = { text: 'نص', lang: 'ar', url: 'https://www.anae.dz/' };
  const base = { name: { ar: 'أ', en: 'a' }, description: { ar: 'ب', en: 'b' } };

  it('accepts the shapes of the pack', () => {
    expect(packValueSchema.safeParse(base).success).toBe(true);
    expect(
      packValueSchema.safeParse({
        ...base,
        note: { ar: 'ن', en: 'n' },
        url: 'https://www.anae.dz/',
        code: 'DZD',
        evidence: [{ ...evidence, cite: 'JO 88' }],
        figures: [{ id: 'rate', text: '0,5 %', evidence: [evidence] }],
      }).success,
    ).toBe(true);
  });

  it('refuses a figure without evidence, an http link and an unknown key', () => {
    expect(
      packValueSchema.safeParse({ ...base, figures: [{ id: 'rate', text: '5%', evidence: [] }] })
        .success,
    ).toBe(false);
    expect(packValueSchema.safeParse({ ...base, url: 'http://www.anae.dz/' }).success).toBe(false);
    expect(packValueSchema.safeParse({ ...base, fee: '10' }).success).toBe(false);
    expect(packValueSchema.safeParse({ ...base, code: 'dzd' }).success).toBe(false);
    expect(packValueSchema.safeParse({ ...base, name: { ar: 'أ', en: '' } }).success).toBe(false);
    expect(
      packValueSchema.safeParse({ ...base, evidence: [{ ...evidence, lang: 'de' }] }).success,
    ).toBe(false);
  });

  it('validates a whole item', () => {
    expect(packItemSchema.safeParse(item('JO', PACK_KEYS.soleRegistration)).success).toBe(true);
    expect(packItemSchema.safeParse({ ...item('JO', 'x'), status: 'checked' }).success).toBe(false);
    expect(
      packItemSchema.safeParse({ ...item('JO', 'x'), lastVerified: '12/10/2026' }).success,
    ).toBe(false);
    expect(
      packItemSchema.safeParse({ ...item('JO', 'x'), sourceUrl: 'ftp://x.gov.jo' }).success,
    ).toBe(false);
    expect(packItemSchema.safeParse({ ...item('JO', 'x'), lastVerified: null }).success).toBe(true);
  });
});
