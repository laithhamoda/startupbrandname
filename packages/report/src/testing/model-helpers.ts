import type { GoldenName } from '@sbn/engine';
import { goldenReportInput, type GoldenReportOptions } from './report-inputs';
import { buildReportModel } from '../model/build';
import type { Block, ReportModel, Section, SectionId, TableBlock } from '../model/types';

/*
 * Small helpers shared by the model tests. Not a test file itself, and not product code.
 */

export const NAMES: readonly GoldenName[] = [
  'jo-service-subscription',
  'jo-home-ecommerce',
  'dz-auto-entrepreneur',
];

export const LOCALES = ['ar', 'en'] as const;

export function modelOf(
  name: GoldenName,
  locale: 'ar' | 'en',
  options: Omit<GoldenReportOptions, 'locale'> = {},
): ReportModel {
  return buildReportModel(goldenReportInput(name, { locale, ...options }));
}

export function sectionOf(model: ReportModel, id: SectionId): Section {
  const found = model.sections.find((section) => section.id === id);
  if (found === undefined) throw new Error(`no section ${id}`);
  return found;
}

export function tablesOf(blocks: readonly Block[]): TableBlock[] {
  return blocks.filter((block): block is TableBlock => block.type === 'table');
}
