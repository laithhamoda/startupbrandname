import { createHash } from 'node:crypto';
import {
  type EngineParamOverrides,
  ENGINE_VERSION,
  type PricingOptions,
  type ProvenanceBySteps,
  type TaxRule,
} from '@sbn/engine';
import type { Answers, Mode } from '@sbn/question-bank';

/** Everything a run reads, so that the same inputs always give the same hash (rule 4, D-238). */
export interface RunInputs {
  readonly country: string;
  readonly currency: string;
  readonly mode: Mode;
  /** The month the run is made in, YYYY-MM: month 1 of the projection is the one after it. */
  readonly referenceMonth: string;
  readonly answers: Answers;
  readonly provenance: ProvenanceBySteps;
  readonly taxRules: readonly TaxRule[];
  readonly overrides: EngineParamOverrides;
  readonly options: PricingOptions;
}

/** Bumped when the way inputs are written to text changes, so old hashes are never reused. */
const HASH_FORMAT = 1;

/**
 * The text a hash is made from: JSON with every object's keys sorted and a bigint written as
 * digits with an "n", so the same value is always the same text. Unlike the engine's
 * `canonicalJson`, fractions are allowed: an answer can be 1.5.
 */
export function canonicalText(value: unknown): string {
  const sorted = (node: unknown): unknown => {
    if (typeof node === 'bigint') return `${node.toString()}n`;
    if (Array.isArray(node)) return (node as unknown[]).map(sorted);
    if (typeof node === 'object' && node !== null) {
      return Object.fromEntries(
        Object.entries(node)
          .filter(([, entry]) => entry !== undefined)
          .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
          .map(([key, entry]) => [key, sorted(entry)]),
      );
    }
    return node;
  };
  return JSON.stringify(sorted(value));
}

/**
 * The sha256 of a run's inputs (D-238): the answers with their provenance, the project's country,
 * currency and mode, the tax rules (in the order of their IDs, whatever order they were read in),
 * the parameter overrides, the pricing options, the month of the run and `ENGINE_VERSION`. A
 * changed answer, rule or engine makes a new hash; opening the page again does not.
 */
export function inputHash(inputs: RunInputs, engineVersion: string = ENGINE_VERSION): string {
  const text = canonicalText({
    format: HASH_FORMAT,
    engineVersion,
    country: inputs.country,
    currency: inputs.currency,
    mode: inputs.mode,
    referenceMonth: inputs.referenceMonth,
    answers: inputs.answers,
    provenance: inputs.provenance,
    taxRules: [...inputs.taxRules].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
    overrides: inputs.overrides,
    options: inputs.options,
  });
  return createHash('sha256').update(text).digest('hex');
}
