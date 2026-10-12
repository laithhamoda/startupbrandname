import { type EngineRun, type PricingOptions, runEngine } from '@sbn/engine';
import type { Answers } from '@sbn/question-bank';
import { sampleAnswers } from '@sbn/question-bank/testing';
import type { Project } from '@/lib/diagnostic/project';
import type { RunSource } from './load';

// Test support for the engine orchestration: a project that can be calculated, and its run.

export const PROJECT: Project = {
  id: '6f1c1f1e-7d4b-4c55-9a51-0f6f5d2b9e10',
  title: 'صيانة مكيّفات المطاعم',
  countryCode: 'JO',
  currency: 'JOD',
  mode: 'full',
  createdAt: '2026-10-01T10:00:00Z',
  updatedAt: '2026-10-01T10:00:00Z',
};

/** The question bank's sample project, which the engine can calculate. */
export function sampleSource(changes: Partial<RunSource> = {}, answers?: Answers): RunSource {
  return {
    project: PROJECT,
    answers: answers ?? sampleAnswers(),
    provenance: {
      F1: { source: 'user', confidence: 'medium', validated: false },
      F3: { source: 'user', confidence: 'medium', validated: false },
    },
    taxRules: [],
    taxRulesRead: true,
    ...changes,
  };
}

export const REFERENCE_DATE = '2026-10-12';

/** The run of a source; throws when its answers cannot be calculated. */
export function runOf(source: RunSource = sampleSource(), options: PricingOptions = {}): EngineRun {
  const result = runEngine(
    source.answers,
    source.provenance,
    {
      country: source.project.countryCode,
      currency: source.project.currency,
      mode: source.project.mode,
      referenceDate: REFERENCE_DATE,
    },
    { rules: source.taxRules },
    {},
    options,
  );
  if (result.status !== 'ok') throw new Error('The sample project cannot be calculated.');
  return result.run;
}
