import { readFileSync } from 'node:fs';
import { FOLLOW_UPS, QUESTIONS } from '@sbn/question-bank';
import { describe, expect, it } from 'vitest';
import { countryOptions } from '@/lib/countries';
import { currencyOptions } from './currencies';
import { COUNTRY_KINDS, CURRENCY_KINDS, editorLists } from './editor-lists';

const KINDS = [...new Set([...QUESTIONS, ...FOLLOW_UPS].map((step) => step.field.kind))].sort();

/**
 * The field kinds whose case in FieldEditor's switch passes on the currency or the country list,
 * read from the component's source, so a kind that starts offering a list cannot be forgotten
 * here (its select would be empty).
 */
function kindsUsing(list: 'currencies' | 'countries'): string[] {
  const source = readFileSync(
    new URL('../../components/diagnostic/field-editor.tsx', import.meta.url),
    'utf8',
  );
  const editor = source.slice(source.indexOf('export function FieldEditor('));
  const kinds: string[] = [];
  let labels: string[] = [];
  for (const part of editor.split(/(\n\s*case '[a-z_]+':)/)) {
    const label = /case '([a-z_]+)':/.exec(part)?.[1];
    if (label) {
      labels.push(label);
      continue;
    }
    // The body after one or more labels; a body made of whitespace is a fall-through.
    if (!part.trim()) continue;
    const pattern = list === 'currencies' ? /currencies=\{currencies\}/ : /options=\{countries\}/;
    if (pattern.test(part)) kinds.push(...labels);
    labels = [];
  }
  return kinds.sort();
}

describe('editorLists (PERF-7)', () => {
  it('sends the currency list exactly to the kinds whose editor offers it', () => {
    expect(kindsUsing('currencies')).toEqual([...CURRENCY_KINDS].sort());
  });

  it('sends the country list exactly to the kinds whose editor offers it', () => {
    expect(kindsUsing('countries')).toEqual([...COUNTRY_KINDS].sort());
  });

  it.each(KINDS)('gives %s only the lists it offers', (kind) => {
    const lists = editorLists(kind, 'ar');
    expect(lists.currencies).toBe(CURRENCY_KINDS.has(kind) ? currencyOptions('ar') : undefined);
    expect(lists.countries).toBe(COUNTRY_KINDS.has(kind) ? countryOptions('ar') : undefined);
  });

  it('leaves most questions without either list', () => {
    const bare = QUESTIONS.filter((question) => {
      const lists = editorLists(question.field.kind, 'en');
      return !lists.countries && !lists.currencies;
    });
    expect(bare.length).toBeGreaterThan(QUESTIONS.length / 2);
  });
});
