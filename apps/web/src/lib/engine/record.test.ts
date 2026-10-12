import { afterEach, describe, expect, it, vi } from 'vitest';
import { log } from '@/lib/log';
import type { SupabaseServerClient } from '@/lib/supabase/server';
import { ENGINE_TOOL_ID, recordEngineRun } from './record';

vi.mock('@/lib/log', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/log')>()),
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const rethrow = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({ unstable_rethrow: rethrow }));

const run = {
  projectId: '6f1c1f1e-7d4b-4c55-9a51-0f6f5d2b9e10',
  inputHash: 'a'.repeat(64),
  engineVersion: '1.1.0',
  summary: { status: 'ok' },
};

interface Behaviour {
  existing?: { id: number }[];
  lookupError?: unknown;
  rpcError?: unknown;
  lookupThrows?: Error;
}

function clientWith(behaviour: Behaviour = {}) {
  const filters: [string, unknown][] = [];
  const rpc = vi.fn(() => Promise.resolve({ data: 1, error: behaviour.rpcError ?? null }));
  const chain = {
    select: () => chain,
    eq: (column: string, value: unknown) => {
      filters.push([column, value]);
      return chain;
    },
    limit: () => {
      if (behaviour.lookupThrows) return Promise.reject(behaviour.lookupThrows);
      return Promise.resolve({
        data: behaviour.lookupError ? null : (behaviour.existing ?? []),
        error: behaviour.lookupError ?? null,
      });
    },
  };
  const client = { from: () => chain, rpc } as unknown as SupabaseServerClient;
  return { client, rpc, filters };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('recordEngineRun (rule 4, D-238, D-244)', () => {
  it('records the summary when the project has no row for these inputs', async () => {
    const { client, rpc, filters } = clientWith();
    expect(await recordEngineRun(client, run)).toBe('recorded');
    expect(filters).toEqual([
      ['project_id', run.projectId],
      ['tool_id', 'engine'],
      ['input_hash', run.inputHash],
    ]);
    expect(rpc).toHaveBeenCalledWith('record_engine_run', {
      p_project_id: run.projectId,
      p_tool_id: ENGINE_TOOL_ID,
      p_input_hash: run.inputHash,
      p_output: run.summary,
      p_engine_version: '1.1.0',
    });
  });

  it('records nothing when a row for the same inputs exists', async () => {
    const { client, rpc } = clientWith({ existing: [{ id: 7 }] });
    expect(await recordEngineRun(client, run)).toBe('exists');
    expect(rpc).not.toHaveBeenCalled();
  });

  it('logs and returns failed when the lookup fails, and writes nothing', async () => {
    const { client, rpc } = clientWith({ lookupError: { code: '42501', message: 'denied' } });
    expect(await recordEngineRun(client, run)).toBe('failed');
    expect(rpc).not.toHaveBeenCalled();
    expect(log.warn).toHaveBeenCalledWith('engine.record_failed', {
      code: '42501',
      projectId: run.projectId,
      stage: 'lookup',
    });
  });

  it('logs and returns failed when the function is missing, as before the M5 migration', async () => {
    const { client } = clientWith({ rpcError: { code: 'PGRST202', message: 'no function' } });
    expect(await recordEngineRun(client, run)).toBe('failed');
    expect(log.warn).toHaveBeenCalledWith('engine.record_failed', {
      code: 'PGRST202',
      projectId: run.projectId,
      stage: 'record',
    });
  });

  it('logs and returns failed when the call throws, with the error’s class and no message', async () => {
    const { client } = clientWith({ lookupThrows: new TypeError('fetch failed: secret') });
    expect(await recordEngineRun(client, run)).toBe('failed');
    expect(log.warn).toHaveBeenCalledWith('engine.record_failed', {
      errorName: 'TypeError',
      projectId: run.projectId,
      stage: 'call',
    });
  });

  it('lets Next.js’s own signals through', async () => {
    const signal = new Error('NEXT_REDIRECT');
    rethrow.mockImplementationOnce(() => {
      throw signal;
    });
    const { client } = clientWith({ lookupThrows: signal });
    await expect(recordEngineRun(client, run)).rejects.toBe(signal);
    expect(rethrow).toHaveBeenCalledWith(signal);
  });
});
