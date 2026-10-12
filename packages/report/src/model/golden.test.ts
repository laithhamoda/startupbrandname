import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { LOCALES, NAMES, modelOf } from '../testing/model-helpers';
import { drop } from '../testing/report-inputs';
import { modelText } from '../testing/model-text';
import type { ReportModel } from './types';

/*
 * The golden ReportModels (D-272). Each model is a file under packages/report/golden/ and a changed
 * word, number or block shows as a diff there: the diff is the review. To accept a change on
 * purpose, run the tests with UPDATE_GOLDEN=1 and read the diff (the rule of D-222). A readable
 * text version of each model sits beside it, because JSON is hard to read as a report.
 */

const GOLDEN_DIR = fileURLToPath(new URL('../../golden/', import.meta.url));

/** True when the run should rewrite the golden files instead of comparing with them. */
const updating = (): boolean => {
  const flag = process.env.UPDATE_GOLDEN;
  if (flag === undefined || flag === '') return false;
  // A rewrite in CI would make a changed number pass unseen (D-222).
  const ci = process.env.CI;
  if (ci !== undefined && ci !== '' && ci !== 'false') {
    throw new Error('UPDATE_GOLDEN must not be set in CI: it would hide a changed number.');
  }
  return true;
};

/** Compares `text` with the file, or writes the file when UPDATE_GOLDEN is set. */
function matchFile(file: string, text: string): void {
  const path = `${GOLDEN_DIR}${file}`;
  if (updating()) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, text, 'utf8');
    return;
  }
  let stored: string;
  try {
    stored = readFileSync(path, 'utf8');
  } catch {
    throw new Error(
      `${path} does not exist. Run the tests once with UPDATE_GOLDEN=1 to create it.`,
    );
  }
  expect(text).toBe(stored);
}

const json = (model: ReportModel): string => `${JSON.stringify(model, null, 2)}\n`;
const reading = (model: ReportModel): string => `${modelText(model)}\n`;

describe('the golden report models', () => {
  for (const name of NAMES) {
    for (const locale of LOCALES) {
      it(`${name}, the full report in ${locale}`, () => {
        const model = modelOf(name, locale);
        matchFile(`${name}.${locale}.golden`, json(model));
        matchFile(`${name}.${locale}.txt`, reading(model));
      });
    }
  }

  it('jo-service-subscription, the free summary in Arabic (locked by the plan)', () => {
    const model = modelOf('jo-service-subscription', 'ar', { kind: 'summary', lockReason: 'plan' });
    matchFile('jo-service-subscription.summary.ar.golden', json(model));
    matchFile('jo-service-subscription.summary.ar.txt', reading(model));
  });

  it('jo-service-subscription, a summary from a trimmed answer set with no run', () => {
    const model = modelOf('jo-service-subscription', 'ar', {
      kind: 'summary',
      lockReason: 'completeness',
      change: (answers, provenance) => {
        drop(answers, 'F3', 'F4', 'F5', 'F6', 'D4', 'E8', 'F4.1');
        drop(provenance, 'F3', 'F4', 'F5', 'F6', 'D4', 'E8', 'F4.1');
      },
    });
    expect(model.meta.engineVersion).toBeNull();
    matchFile('jo-service-subscription.summary-no-run.ar.golden', json(model));
    matchFile('jo-service-subscription.summary-no-run.ar.txt', reading(model));
  });
});
