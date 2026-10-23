import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildReportModel, type ReportModel } from '@sbn/report/model';
import { goldenReportInput } from '@sbn/report/testing/inputs';
import { describe, expect, it } from 'vitest';

// The public sample report (D-293) is a frozen copy of the model of a fictional project, so a change
// to the test fixtures never reaches a public page by accident. These tests keep the copy equal to
// what the report builder makes today. After a change to the engine or the report on purpose, run
//   UPDATE_SAMPLE=1 pnpm --filter @sbn/web exec vitest run src/content/sample-report.test.ts
// then format the two files, read the diff and commit it.
const DIR = fileURLToPath(new URL('./sample-report/', import.meta.url));
const LOCALES = ['ar', 'en'] as const;

/**
 * The fictional Jordanian service project, built as the live site builds a report today: no tax
 * rule and no pack row, so tax is "not calculated". Nothing of the fixtures' made-up legal items or
 * tax regime reaches the sample. The sample also drops the legal and tax notices of the legal path
 * section and keeps its financing list: those notices describe the state of the country's data on
 * the day, which the sample must not freeze (rule 8); the page says so beside the report.
 */
function sampleModel(locale: 'ar' | 'en'): ReportModel {
  const input = goldenReportInput('jo-service-subscription', {
    locale,
    kind: 'full',
    tax: { rules: [] },
  });
  const model = buildReportModel({ ...input, packItems: [] });
  return {
    ...model,
    sections: model.sections.map((section) =>
      section.id === 'legal_path_financing'
        ? { ...section, blocks: section.blocks.filter((block) => block.type === 'list') }
        : section,
    ),
  };
}

const normal = (model: ReportModel): unknown => JSON.parse(JSON.stringify(model));
const readSample = (locale: 'ar' | 'en'): ReportModel =>
  JSON.parse(readFileSync(`${DIR}${locale}.json`, 'utf8')) as ReportModel;

describe('the sample report (D-293)', () => {
  if (process.env.UPDATE_SAMPLE === '1') {
    if (process.env.CI) throw new Error('UPDATE_SAMPLE must not be set in CI.');
    it('writes the sample files', () => {
      mkdirSync(DIR, { recursive: true });
      for (const locale of LOCALES) {
        writeFileSync(`${DIR}${locale}.json`, JSON.stringify(sampleModel(locale)), 'utf8');
      }
    });
  }

  for (const locale of LOCALES) {
    describe(locale, () => {
      it('is the report the builder makes today, so it never drifts', () => {
        expect(readSample(locale)).toEqual(normal(sampleModel(locale)));
      });

      it('is the full report of the fictional project, in its own language', () => {
        const model = readSample(locale);
        expect(model.kind).toBe('full');
        expect(model.locale).toBe(locale);
        expect(model.sections.filter((section) => section.locked)).toEqual([]);
        expect(model.sections.map((section) => section.id)).toEqual(
          expect.arrayContaining([
            'executive_summary',
            'projection',
            'scenarios_sensitivity',
            'validation_plan',
          ]),
        );
      });

      it('carries nothing made up for a fixture: no address, no test mark, no invented regime', () => {
        const text = JSON.stringify(readSample(locale));
        for (const marker of [
          'example.invalid',
          'https://',
          'http://',
          'fixture',
          'تجريبي',
          'test note',
          'A test note',
          'Test item',
        ]) {
          expect(text, marker).not.toContain(marker);
        }
      });

      it('says that tax was not calculated, and freezes no legal or tax statement', () => {
        const model = readSample(locale);
        const executive = model.sections.find((section) => section.id === 'executive_summary');
        expect((executive?.blocks ?? []).some((block) => block.type === 'note')).toBe(true);
        // The legal path section keeps its financing list only: no registration step, no tax regime,
        // no official link, no statement about the state of the country's data.
        const legal = model.sections.find((section) => section.id === 'legal_path_financing');
        expect(legal?.blocks.map((block) => block.type)).toEqual(['list']);
      });
    });
  }
});
