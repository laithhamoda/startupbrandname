import { afterEach, describe, expect, it, vi } from 'vitest';
import { log } from '@/lib/log';
import type { SupabaseServerClient } from '@/lib/supabase/server';
import { loadRunSource, provenanceOfRows } from './load';
import { PROJECT } from './testing';

vi.mock('@/lib/log', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/log')>()),
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const answered = (value: unknown) => ({ status: 'answered', value });
const costs = answered({ items: [{ label: 'قطع', amount: 8, currency: 'JOD' }] });

const projectRow = {
  id: PROJECT.id,
  title: PROJECT.title,
  country_code: 'JO',
  currency: 'JOD',
  mode: 'full',
  created_at: PROJECT.createdAt,
  updated_at: PROJECT.updatedAt,
};

const answerRow = (
  question_id: string,
  normalized_value: unknown,
  changes: { source?: string; confidence?: string; validated?: boolean } = {},
) => ({
  question_id,
  normalized_value,
  source: 'user',
  confidence: 'medium',
  validated: false,
  ...changes,
});

const ruleRow = {
  id: '3f5c1e0a-0b9e-4a53-8f55-2f0f6a9c1111',
  country_code: 'JO',
  legal_form: 'sole',
  regime: 'simple',
  levy: 'income_tax',
  kind: 'tax',
  basis: 'turnover',
  rate: '1/20',
  brackets: [],
  fixed_amount: null,
  min_amount: null,
  ceiling: null,
  currency: 'JOD',
  payment_month: 4,
  effective_from: '2026-01-01',
  source_url: 'https://example.test/rules/jo',
  last_verified: '2026-09-01',
  status: 'verified',
  created_at: '2026-09-01T00:00:00Z',
  updated_at: '2026-09-01T00:00:00Z',
};

interface Tables {
  project?: unknown;
  projectError?: unknown;
  answers?: unknown[];
  answersError?: unknown;
  rules?: unknown[];
  rulesError?: unknown;
}

/** A client answering each table's query, and noting what was asked of it. */
function clientWith(tables: Tables) {
  const asked: { table: string; columns: string; filters: [string, unknown][] }[] = [];
  const result = (table: string) => {
    if (table === 'projects') {
      return { data: tables.project ?? null, error: tables.projectError ?? null };
    }
    if (table === 'answers') {
      return {
        data: tables.answersError ? null : (tables.answers ?? []),
        error: tables.answersError ?? null,
      };
    }
    return {
      data: tables.rulesError ? null : (tables.rules ?? []),
      error: tables.rulesError ?? null,
    };
  };
  const client = {
    from: (table: string) => {
      const entry = { table, columns: '', filters: [] as [string, unknown][] };
      asked.push(entry);
      const chain = {
        select: (columns: string) => {
          entry.columns = columns;
          return chain;
        },
        eq: (column: string, value: unknown) => {
          entry.filters.push([column, value]);
          return chain;
        },
        maybeSingle: () => Promise.resolve(result(table)),
        then: (resolve: (value: unknown) => unknown) =>
          Promise.resolve(result(table)).then(resolve),
      };
      return chain;
    },
  } as unknown as SupabaseServerClient;
  return { client, asked };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('provenanceOfRows', () => {
  const answers = { F3: costs, 'F4.1': answered({ amount: 5, currency: 'JOD' }) } as never;

  it('keeps the stored provenance of each answer that was read', () => {
    expect(
      provenanceOfRows(
        [
          answerRow('F3', costs, { source: 'assumption', confidence: 'low' }),
          answerRow('F4.1', costs, { validated: true }),
        ],
        answers,
      ),
    ).toEqual({
      F3: { source: 'assumption', confidence: 'low', validated: false },
      'F4.1': { source: 'user', confidence: 'medium', validated: true },
    });
  });

  it('leaves out a row whose provenance does not fit, a row that is no step and an answer not read', () => {
    expect(
      provenanceOfRows(
        [
          answerRow('F3', costs, { source: 'guess' }),
          answerRow('Z9', costs),
          answerRow('A2', answered(3)),
        ],
        answers,
      ),
    ).toEqual({});
  });
});

describe('loadRunSource', () => {
  it('reads the project, its answers with their provenance and the rules of its country', async () => {
    const { client, asked } = clientWith({
      project: projectRow,
      answers: [answerRow('F3', costs, { source: 'assumption', confidence: 'low' })],
      rules: [ruleRow],
    });
    const source = await loadRunSource(client, PROJECT.id);

    expect(source?.project).toEqual(PROJECT);
    expect(source?.answers).toEqual({ F3: costs });
    expect(source?.provenance).toEqual({
      F3: { source: 'assumption', confidence: 'low', validated: false },
    });
    expect(source?.taxRules.map((rule) => rule.levy)).toEqual(['income_tax']);
    expect(source?.taxRulesRead).toBe(true);
    expect(asked.map((query) => query.table).sort()).toEqual(['answers', 'projects', 'tax_rules']);
    expect(asked.find((query) => query.table === 'answers')?.columns).toContain('confidence');
    expect(asked.find((query) => query.table === 'tax_rules')?.filters).toEqual([
      ['country_code', 'JO'],
    ]);
  });

  it('works with an empty tax_rules table, as it is until step 4', async () => {
    const { client } = clientWith({ project: projectRow, answers: [] });
    const source = await loadRunSource(client, PROJECT.id);
    expect(source?.taxRules).toEqual([]);
    expect(source?.taxRulesRead).toBe(true);
    expect(log.warn).not.toHaveBeenCalled();
  });

  it('is null for an ID that is no UUID, without asking the database', async () => {
    const { client, asked } = clientWith({});
    expect(await loadRunSource(client, 'not-a-uuid')).toBeNull();
    expect(asked).toEqual([]);
  });

  it('is null for a project that is not the account’s', async () => {
    const { client, asked } = clientWith({ project: null });
    expect(await loadRunSource(client, PROJECT.id)).toBeNull();
    expect(asked.some((query) => query.table === 'tax_rules')).toBe(false);
  });

  it('throws when the project or the answers cannot be read', async () => {
    const failure = { code: '57014', message: 'timeout' };
    await expect(
      loadRunSource(clientWith({ projectError: failure }).client, PROJECT.id),
    ).rejects.toBe(failure);
    await expect(
      loadRunSource(clientWith({ project: projectRow, answersError: failure }).client, PROJECT.id),
    ).rejects.toBe(failure);
  });

  it('runs without a regime when the rules cannot be read at all, and says so', async () => {
    // A database that has not had the M5 migration has no tax_rules table.
    const { client } = clientWith({
      project: projectRow,
      rulesError: { code: 'PGRST205', message: 'Could not find the table' },
    });
    const source = await loadRunSource(client, PROJECT.id);
    expect(source?.taxRules).toEqual([]);
    expect(source?.taxRulesRead).toBe(false);
    expect(log.warn).toHaveBeenCalledWith('engine.tax_rules_unavailable', {
      code: 'PGRST205',
      projectId: PROJECT.id,
    });
  });

  it('leaves out a rule the engine cannot read and logs how many, never the rule', async () => {
    const { client } = clientWith({
      project: projectRow,
      rules: [ruleRow, { ...ruleRow, id: 'bad', currency: 'ZZZ' }],
    });
    const source = await loadRunSource(client, PROJECT.id);
    expect(source?.taxRules).toHaveLength(1);
    expect(source?.taxRulesRead).toBe(true);
    expect(log.warn).toHaveBeenCalledWith('engine.tax_rules_unreadable', {
      projectId: PROJECT.id,
      count: 1,
    });
  });
});
