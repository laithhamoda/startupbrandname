import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  ALERT_SEVERITY,
  CRITERION_IDS,
  EXPERIMENT_LIBRARY,
  TAX_ALERT_SEVERITY,
  type BlockerCode,
  type HoldBack,
} from '@sbn/engine';
import { describe, expect, it } from 'vitest';
import { inlineText } from '../model/inline';
import type { Inline } from '../model/types';
import { ar, en, messagesFor } from './index';
import { CARD_ROWS, EXPERIMENT_CODES, PARAM_LABEL_KEYS, TERM_KEYS } from './types';

/** Any slot a template asks for is a number part, so a template can never be tested with a digit in it. */
const sample: Inline = [{ n: '7' }];
const slots = new Proxy<Record<string, unknown>>({}, { get: () => sample });

const DIGITS = /[0-9٠-٩۰-۹]/u;

/** The text inside every quoted string and template literal of a source file, minus `${...}` parts. */
function literalsOf(source: string): string[] {
  const found: string[] = [];
  let index = 0;
  while (index < source.length) {
    const char = source.charAt(index);
    const next = source.charAt(index + 1);
    if (char === '/' && next === '/') {
      while (index < source.length && source.charAt(index) !== '\n') index += 1;
    } else if (char === '/' && next === '*') {
      index = source.indexOf('*/', index + 2) + 2;
    } else if (char === "'" || char === '"' || char === '`') {
      let body = '';
      index += 1;
      while (index < source.length && source.charAt(index) !== char) {
        const here = source.charAt(index);
        if (here === '\\') {
          body += source.charAt(index + 1);
          index += 2;
        } else if (char === '`' && here === '$' && source.charAt(index + 1) === '{') {
          let depth = 1;
          index += 2;
          while (index < source.length && depth > 0) {
            if (source.charAt(index) === '{') depth += 1;
            if (source.charAt(index) === '}') depth -= 1;
            index += 1;
          }
        } else {
          body += here;
          index += 1;
        }
      }
      found.push(body);
      index += 1;
    } else {
      index += 1;
    }
  }
  return found;
}

interface Leaf {
  readonly path: string;
  readonly value: unknown;
}

/** Every string and function of a catalog, with its path. */
function leaves(value: unknown, path = ''): Leaf[] {
  if (typeof value === 'string' || typeof value === 'function') return [{ path, value }];
  if (Array.isArray(value)) {
    return value.flatMap((item: unknown, index) => leaves(item, `${path}[${String(index)}]`));
  }
  if (typeof value === 'object' && value !== null) {
    return Object.entries(value)
      .filter(([key]) => key !== 'english')
      .flatMap(([key, item]) => leaves(item, path === '' ? key : `${path}.${key}`));
  }
  throw new Error(`${path} is neither text nor a template`);
}

/** What a leaf says: the string, or what the template writes for the sample slots. */
function say(leaf: Leaf): { plain: string; digitsInFixedText: boolean } {
  if (typeof leaf.value === 'string') {
    return { plain: leaf.value, digitsInFixedText: DIGITS.test(leaf.value) };
  }
  const written = (leaf.value as (given: unknown) => Inline)(slots);
  // Fixed text is every plain string; numbers and fragments arrive through slots as objects.
  const fixed = written.filter((part): part is string => typeof part === 'string').join('');
  return { plain: inlineText(written), digitsInFixedText: DIGITS.test(fixed) };
}

describe('the report message catalogs', () => {
  const arLeaves = leaves(ar);
  const enLeaves = leaves(en);

  it('have the same keys in both languages, and the same kind of entry at each', () => {
    expect(arLeaves.map((leaf) => leaf.path)).toEqual(enLeaves.map((leaf) => leaf.path));
    arLeaves.forEach((leaf, index) => {
      expect(typeof leaf.value, leaf.path).toBe(typeof enLeaves[index]?.value);
    });
  });

  it('say something for every entry, with sample slots', () => {
    for (const leaf of [...arLeaves, ...enLeaves]) {
      expect(say(leaf).plain.trim(), leaf.path).not.toBe('');
    }
  });

  it('hold no digit at all in fixed text, Western or Arabic-Indic (CLAUDE.md rule 1)', () => {
    for (const leaf of [...arLeaves, ...enLeaves]) {
      expect(say(leaf).digitsInFixedText, leaf.path).toBe(false);
    }
  });

  it('hold no digit in any string or template of the catalog sources either', () => {
    for (const file of ['ar.ts', 'en.ts']) {
      const source = readFileSync(fileURLToPath(new URL(file, import.meta.url)), 'utf8');
      for (const text of literalsOf(source)) {
        // A key such as 'growth.year3_share_of_year2' names a parameter; it is not report text.
        if (/^[a-z0-9_.]+$/.test(text)) continue;
        expect(DIGITS.test(text), `${file}: ${text}`).toBe(false);
      }
    }
  });

  it('cover every alert, blocker, hold-back, criterion and experiment code of the engine', () => {
    for (const messages of [ar, en]) {
      const alertCodes = [...Object.keys(ALERT_SEVERITY), ...Object.keys(TAX_ALERT_SEVERITY)];
      expect(Object.keys(messages.alerts).sort()).toEqual(alertCodes.sort());
      const blockers: BlockerCode[] = [
        'margin_not_positive',
        'no_break_even_in_window',
        'funding_need_above_capital_multiple',
      ];
      expect(Object.keys(messages.risks.blockers).sort()).toEqual([...blockers].sort());
      const holdBacks: HoldBack[] = ['score_below_line', 'no_score', 'confidence_low'];
      expect(Object.keys(messages.executive.holdBacks).sort()).toEqual([...holdBacks].sort());
      expect(Object.keys(messages.executive.criteria).sort()).toEqual([...CRITERION_IDS].sort());
      for (const experiment of Object.values(EXPERIMENT_LIBRARY)) {
        for (const code of [experiment.metric, experiment.threshold, experiment.fallback]) {
          expect(Object.keys(messages.validation.codes), code).toContain(code);
        }
      }
      expect(Object.keys(messages.validation.codes).sort()).toEqual([...EXPERIMENT_CODES].sort());
      expect(Object.keys(messages.terms).sort()).toEqual([...TERM_KEYS].sort());
      expect(Object.keys(messages.card.rows).sort()).toEqual([...CARD_ROWS].sort());
      expect(Object.keys(messages.appendix.parameters).sort()).toEqual(
        [...PARAM_LABEL_KEYS].sort(),
      );
    }
  });

  it('write the verdict words and the stop sentence as D-227 fixes them', () => {
    expect(ar.verdictWords).toEqual({ go: 'امضِ', revise: 'عدّل', stop: 'توقّف' });
    expect(ar.stopSentence).toBe('غير قابل للتنفيذ بصيغته الحالية');
    expect(en.verdictWords).toEqual({ go: 'Go', revise: 'Revise', stop: 'Stop' });
    expect(en.stopSentence).toBe('Not viable in its current form');
  });

  it('write the low-confidence sentence of SPEC section 6', () => {
    expect(ar.lowConfidence).toBe('هذا الرقم افتراض، اختبره قبل أن تبني عليه قراراً.');
  });

  it('put the English term in parentheses only in the Arabic catalog', () => {
    for (const key of TERM_KEYS) {
      expect(ar.terms[key].english, key).not.toBeNull();
      expect(en.terms[key].english, key).toBeNull();
    }
  });

  it('never name a term outside the term tracker, so its first use can carry the gloss', () => {
    const names = TERM_KEYS.map((key) => ar.terms[key].name);
    for (const leaf of arLeaves) {
      if (leaf.path.startsWith('terms.')) continue;
      for (const name of names) {
        expect(say(leaf).plain.includes(name), `${leaf.path} names ${name}`).toBe(false);
      }
    }
  });

  it('pick the right plural of months in Arabic and English', () => {
    const n = (count: number): Inline => [{ n: String(count) }];
    const text = (messages: typeof ar, count: number) =>
      inlineText(messages.months({ count, n: n(count) }));
    expect([1, 2, 3, 10, 11, 36].map((count) => text(ar, count))).toEqual([
      'شهر واحد',
      'شهرين',
      '3 أشهر',
      '10 أشهر',
      '11 شهرًا',
      '36 شهرًا',
    ]);
    expect([1, 2, 3, 36].map((count) => text(en, count))).toEqual([
      'one month',
      'two months',
      '3 months',
      '36 months',
    ]);
  });

  it('pick the right plural of units and changes in Arabic and English', () => {
    const n = (count: number): Inline => [{ n: String(count) }];
    const units = (messages: typeof ar, count: number) =>
      inlineText(messages.units({ count, n: n(count) }));
    const changes = (messages: typeof ar, count: number) =>
      inlineText(messages.changes({ count, n: n(count) }));
    expect([1, 2, 3, 10, 11, 171].map((count) => units(ar, count))).toEqual([
      'وحدة واحدة',
      'وحدتين',
      '3 وحدات',
      '10 وحدات',
      '11 وحدة',
      '171 وحدة',
    ]);
    expect([1, 2, 3, 11].map((count) => changes(ar, count))).toEqual([
      'تغيير واحد',
      'تغييرين',
      '3 تغييرات',
      '11 تغييرًا',
    ]);
    expect([1, 2, 5].map((count) => units(en, count))).toEqual([
      'one unit',
      'two units',
      '5 units',
    ]);
    expect([1, 2, 5].map((count) => changes(en, count))).toEqual([
      'one change',
      'two changes',
      '5 changes',
    ]);
  });

  it('picks the catalog of the report language', () => {
    expect(messagesFor('ar')).toBe(ar);
    expect(messagesFor('en')).toBe(en);
  });
});
