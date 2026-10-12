import type { Answers } from '@sbn/question-bank';
import { packLabel, type PackLabel } from './label';
import { PACK_KEYS, type PackKey } from './keys';
import type { PackItem } from './schema';

/**
 * Why a step is in the guide: the main path, a condition of a path, an alternative path, a choice
 * to compare, a step the founder's answers added, a pointer to another item.
 */
export type GuideRole =
  | 'path'
  | 'condition'
  | 'alternative'
  | 'comparison'
  | 'sector'
  | 'home'
  | 'confirm'
  | 'note'
  | 'always';

/** One step of the registration guide T17. It carries codes and an item, never text of its own. */
export interface GuideStep {
  /** Stable among the steps of a guide, such as `jo.sole`. */
  readonly key: string;
  readonly role: GuideRole;
  /** The key of the pack item the step rests on; its words are the item's. */
  readonly itemKey: PackKey;
  readonly item: PackItem;
  readonly label: PackLabel | null;
}

export interface RegistrationGuide {
  /** False when the country has no item at all: the report says there is no verified pack. */
  readonly hasPack: boolean;
  readonly country: string;
  readonly steps: readonly GuideStep[];
  /** Keys a rule wanted but the pack does not hold, so the report can say what is not covered. */
  readonly missing: readonly PackKey[];
}

export interface GuideInput {
  /** ISO 3166-1 alpha-2 of the project's country (the country of A1). */
  readonly country: string;
  readonly answers: Answers;
  /** Items of any country; the guide uses the ones of `country`. */
  readonly items: readonly PackItem[];
  /** `YYYY-MM-DD`: the day the report is made. */
  readonly today: string;
}

// ----- Reading the answers (defensive: an answer is data from the database) --------------------

function answeredValue(answers: Answers, id: keyof Answers): unknown {
  const answer = answers[id];
  return answer?.status === 'answered' ? answer.value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Arabic marks that do not change the word: the vowel signs, the shadda and the tatweel. */
function isArabicMark(code: number): boolean {
  return (code >= 0x064b && code <= 0x0652) || code === 0x0670 || code === 0x0640;
}

/** Lowercase words of a free-text city, without Arabic marks. Walks the text once. */
function wordsOf(text: string): string[] {
  const words: string[] = [];
  let current = '';
  for (const char of text.toLowerCase()) {
    const code = char.codePointAt(0) ?? 0;
    if (isArabicMark(code)) continue;
    const isLetterOrDigit =
      char.toLowerCase() !== char.toUpperCase() || (char >= '0' && char <= '9');
    // Arabic letters have no case, so they are told apart by their block.
    const isArabicLetter = code >= 0x0621 && code <= 0x064a;
    if (isLetterOrDigit || isArabicLetter) {
      current += char;
    } else if (current !== '') {
      words.push(current);
      current = '';
    }
  }
  if (current !== '') words.push(current);
  return words;
}

const AMMAN_WORDS: readonly string[] = ['amman', 'عمان'];

/** A1 names Amman: its city holds the word, in Latin or Arabic letters (A1 is free text). */
function isAmman(answers: Answers): boolean {
  const value = answeredValue(answers, 'A1');
  if (!isRecord(value) || typeof value.city !== 'string') return false;
  return wordsOf(value.city).some((word) => AMMAN_WORDS.includes(word));
}

/** E6 is `home` (the real option value of the question). */
function worksFromHome(answers: Answers): boolean {
  return answeredValue(answers, 'E6') === 'home';
}

const PARTNER_WORDS: readonly string[] = [
  'شريك',
  'شريكة',
  'شركاء',
  'شراكة',
  'partner',
  'partners',
  'co-founder',
  'cofounder',
  'co founder',
];

/** A4 lists a partner: a role or its detail says so (A4 asks for roles, not names). */
function hasPartners(answers: Answers): boolean {
  const value = answeredValue(answers, 'A4');
  if (!isRecord(value) || !Array.isArray(value.items)) return false;
  return value.items.some((entry: unknown) => {
    if (!isRecord(entry)) return false;
    const said = [entry.name, entry.detail]
      .filter((part): part is string => typeof part === 'string')
      .join(' ')
      .toLowerCase();
    return PARTNER_WORDS.some((word) => said.includes(word));
  });
}

/** D6 is yes: the project depends on imports or a foreign currency. */
function dependsOnImports(answers: Answers): boolean {
  const value = answeredValue(answers, 'D6');
  return isRecord(value) && value.answer === true;
}

/**
 * Sector approvals come from D2, the sector question, and not from B7 (D-233). D2 holds ISIC
 * sections (D-106), which cannot tell a food maker from a food shop or name cosmetics at all, so
 * the reading is deliberately narrow and the owner may change it (OPEN-QUESTIONS #94):
 *  - food approval: `I` (accommodation and food service) and `C` (manufacturing, which holds food
 *    production);
 *  - cosmetics approval: `C` only, the section that holds their manufacture.
 * Trade (`G`) and agriculture (`A`) add nothing: a shop or farm is not shown an approval it may not
 * need, and the founder still sees the vocational licence step.
 */
const FOOD_SECTORS: readonly string[] = ['I', 'C'];
const COSMETICS_SECTORS: readonly string[] = ['C'];

function sectorOf(answers: Answers): string | null {
  const value = answeredValue(answers, 'D2');
  return typeof value === 'string' ? value : null;
}

// ----- The guide -------------------------------------------------------------------------------

/** Builds the steps in order, taking each item from the pack and the label from rule 8. */
class Builder {
  readonly steps: GuideStep[] = [];
  readonly missing: PackKey[] = [];
  private readonly byKey: Map<string, PackItem>;

  constructor(
    items: readonly PackItem[],
    private readonly today: string,
  ) {
    this.byKey = new Map(items.map((item) => [item.key, item]));
  }

  add(key: string, role: GuideRole, itemKey: PackKey): void {
    const item = this.byKey.get(itemKey);
    if (item === undefined) {
      this.missing.push(itemKey);
      return;
    }
    this.steps.push({ key, role, itemKey, item, label: packLabel(item, this.today) });
  }
}

function jordanGuide(builder: Builder, answers: Answers): void {
  builder.add('jo.sole', 'path', PACK_KEYS.soleRegistration);
  if (hasPartners(answers)) builder.add('jo.company', 'comparison', PACK_KEYS.companyRegistration);
  builder.add('jo.chamber', 'always', PACK_KEYS.chamberMembership);
  const sector = sectorOf(answers);
  if (sector !== null && FOOD_SECTORS.includes(sector)) {
    builder.add('jo.food_approval', 'sector', PACK_KEYS.foodApproval);
  }
  if (sector !== null && COSMETICS_SECTORS.includes(sector)) {
    builder.add('jo.cosmetics_approval', 'sector', PACK_KEYS.cosmeticsApproval);
  }
  builder.add('jo.vocational', 'always', PACK_KEYS.vocationalLicence);
  if (worksFromHome(answers) && isAmman(answers)) {
    builder.add('jo.home_business', 'home', PACK_KEYS.homeBusinessAmman);
  }
  builder.add('jo.tax', 'always', PACK_KEYS.taxRegistration);
  builder.add('jo.social_security', 'always', PACK_KEYS.socialSecurity);
}

function algeriaGuide(builder: Builder, answers: Answers): void {
  builder.add('dz.auto_entrepreneur', 'path', PACK_KEYS.autoEntrepreneur);
  // A link to the official list, never a decision about eligibility (D-233).
  builder.add('dz.activity_list', 'confirm', PACK_KEYS.autoEntrepreneurActivityList);
  builder.add('dz.ceiling', 'condition', PACK_KEYS.ifuRateCeiling);
  if (dependsOnImports(answers)) {
    builder.add('dz.micro_import', 'note', PACK_KEYS.microImport);
    builder.add('dz.micro_import_limits', 'note', PACK_KEYS.microImportLimits);
  }
  builder.add('dz.commercial_register', 'alternative', PACK_KEYS.commercialRegister);
  builder.add('dz.social_security', 'always', PACK_KEYS.socialSecurity);
  builder.add('dz.tax', 'always', PACK_KEYS.taxRegistration);
}

/**
 * T17: the ordered registration guide for the project's country (D-233, D-265). Pure: the same
 * answers and items give the same guide. A country with no item gives no steps and `hasPack:
 * false`. The turnover is never compared with the ceiling here: the ceiling is text in the pack
 * and the report shows it beside the founder's own figure.
 */
export function registrationGuide(input: GuideInput): RegistrationGuide {
  const country = input.country.toUpperCase();
  const items = input.items.filter((item) => item.countryCode === country);
  if (items.length === 0) return { hasPack: false, country, steps: [], missing: [] };
  const builder = new Builder(items, input.today);
  if (country === 'JO') jordanGuide(builder, input.answers);
  else if (country === 'DZ') algeriaGuide(builder, input.answers);
  return { hasPack: true, country, steps: builder.steps, missing: builder.missing };
}

// ----- Official links --------------------------------------------------------------------------

export interface OfficialLink {
  readonly url: string;
  readonly name: { readonly ar: string; readonly en: string };
  readonly label: PackLabel | null;
}

/**
 * The official tax authority link of a country with its label code (D-233). Null when the pack has
 * no such item or it holds no link: the report then shows the adviser line without a link, never
 * an invented one.
 */
export function officialLinks(
  country: string,
  items: readonly PackItem[],
  today: string,
): OfficialLink | null {
  const code = country.toUpperCase();
  const item = items.find((candidate) => {
    return candidate.countryCode === code && candidate.key === PACK_KEYS.taxAuthority;
  });
  const url = item?.value.url;
  if (item === undefined || url === undefined) return null;
  return { url, name: item.value.name, label: packLabel(item, today) };
}
