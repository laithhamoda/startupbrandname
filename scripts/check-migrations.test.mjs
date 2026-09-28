import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { checkMigrations, findDestructive, sqlStatements } from './check-migrations.mjs';

const kinds = (sql) => findDestructive(sql).map(({ name }) => name);
const migration = (name) =>
  readFileSync(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8');

describe('sqlStatements', () => {
  it('splits statements and normalizes case and whitespace', () => {
    expect(sqlStatements('CREATE TABLE a (id int);\n\n  ALTER TABLE a\n  ADD b text;')).toEqual([
      'create table a (id int)',
      'alter table a add b text',
    ]);
  });

  it('removes line comments and nested block comments', () => {
    expect(
      sqlStatements('-- drop table a;\nselect 1; /* drop /* table */ b; */ select 2;'),
    ).toEqual(['select 1', 'select 2']);
  });

  it('empties string literals, keeping semicolons inside them out of the split', () => {
    expect(sqlStatements("insert into t values ('drop table x; it''s', E'a\\'; b');")).toEqual([
      "insert into t values ('', e'')",
    ]);
  });

  it('empties dollar-quoted bodies, tagged or not', () => {
    expect(
      sqlStatements(
        'create function f() returns void language sql as $$ drop table x; $$;' +
          'do $body$ begin execute $q$drop table y$q$; end $body$;',
      ),
    ).toEqual(["create function f() returns void language sql as ''", "do ''"]);
  });

  it('keeps quoted identifiers and positional parameters', () => {
    expect(sqlStatements('drop table "odd;name""x"; select $1;')).toEqual([
      'drop table "odd;name""x"',
      'select $1',
    ]);
  });
});

describe('findDestructive', () => {
  it('finds drops of tables, views, functions, types and schemas', () => {
    expect(kinds('drop table if exists public.a;')).toEqual(['drops an object']);
    expect(kinds('DROP FUNCTION public.f(text, boolean);')).toEqual(['drops an object']);
    expect(kinds('drop materialized view v; drop type t; drop schema s cascade;')).toHaveLength(3);
  });

  it('leaves drops that keep the data alone', () => {
    expect(
      kinds(
        'drop policy "p" on public.a; drop index a_idx; drop trigger t on public.a;' +
          'alter table a drop constraint a_check;' +
          'alter table a alter column b drop not null, alter column c drop default;',
      ),
    ).toEqual([]);
  });

  it('finds dropped columns, with or without the COLUMN keyword', () => {
    expect(kinds('alter table public.a drop column b, add column c boolean;')).toEqual([
      'drops a column',
    ]);
    expect(kinds('alter table a drop if exists b;')).toEqual(['drops a column']);
    expect(kinds('alter table a drop constraint k, drop b;')).toEqual(['drops a column']);
  });

  it('finds renames of tables, columns, functions and type values', () => {
    expect(kinds('alter table a rename to b;')).toEqual(['renames something']);
    expect(kinds('alter table a rename column b to c;')).toEqual(['renames something']);
    expect(kinds('alter function public.f() rename to g;')).toEqual(['renames something']);
    expect(kinds("alter type status rename value 'a' to 'b';")).toEqual(['renames something']);
  });

  it('leaves renames of constraints and indexes alone', () => {
    expect(kinds('alter table a rename constraint k to l; alter index i rename to j;')).toEqual([]);
  });

  it('finds column type changes', () => {
    expect(kinds('alter table a alter column b type bigint;')).toEqual(['changes a column type']);
    expect(kinds('alter table a alter column b set data type text;')).toEqual([
      'changes a column type',
    ]);
    expect(kinds('alter table a alter b type bigint using b::bigint;')).toEqual([
      'changes a column type',
    ]);
  });

  it('does not mistake a column named type for a type change', () => {
    expect(
      kinds('alter table a alter column type set not null; alter table a add column type text;'),
    ).toEqual([]);
  });

  it('finds dropped type attributes and truncations', () => {
    expect(kinds('alter type t drop attribute a;')).toEqual(['drops a type attribute']);
    expect(kinds('truncate public.a;')).toEqual(['empties a table']);
  });

  it('ignores statements inside function bodies, comments and strings', () => {
    expect(
      kinds(
        'create function f() returns void language plpgsql as $$ begin drop table t; end; $$;\n' +
          "-- drop table a;\ninsert into public.settings (key, value) values ('k', '\"drop table a\"');",
      ),
    ).toEqual([]);
  });

  it('finds the drops shipped with the app change in 20260926140000 (D-086)', () => {
    expect(kinds(migration('20260926140000_signup_without_declarations.sql'))).toEqual([
      'drops an object',
      'drops a column',
    ]);
  });

  it('passes the expand-only migrations', () => {
    for (const name of [
      '20260924000000_baseline_private_schema.sql',
      '20260926100000_accounts.sql',
      '20260927200000_projects_and_answers.sql',
      '20260928090000_ai_usage.sql',
    ]) {
      expect(kinds(migration(name)), name).toEqual([]);
    }
  });
});

describe('checkMigrations', () => {
  const baseFiles = ['20260926100000_accounts.sql', '20260928090000_ai_usage.sql'];
  const path = (name) => `supabase/migrations/${name}`;
  const check = (changes, files = {}) =>
    checkMigrations({ baseFiles, changes, read: (p) => files[p] ?? 'create table x (id int);' });

  it('passes a new expand migration that sorts after the base', () => {
    expect(check([{ status: 'A', path: path('20260929100000_vouchers.sql') }])).toEqual([]);
  });

  it('fails when a merged migration is edited or deleted', () => {
    const problems = check([
      { status: 'M', path: path('20260928090000_ai_usage.sql') },
      { status: 'D', path: path('20260926100000_accounts.sql') },
    ]);
    expect(problems).toHaveLength(2);
    expect(problems[0]).toMatch(/ai_usage\.sql: edited after it was merged/);
    expect(problems[1]).toMatch(/accounts\.sql: deleted or renamed after it was merged/);
  });

  it('fails a rename, which git reports as a deletion and an addition', () => {
    const problems = check([
      { status: 'D', path: path('20260928090000_ai_usage.sql') },
      { status: 'A', path: path('20260928090000_ai_usage_renamed.sql') },
    ]);
    expect(problems.some((p) => p.includes('deleted or renamed'))).toBe(true);
    expect(problems.some((p) => p.includes('must sort after 20260928090000'))).toBe(true);
  });

  it('fails a new version at or below the newest on the base', () => {
    expect(check([{ status: 'A', path: path('20260928090000_same.sql') }])).toEqual([
      expect.stringContaining('version 20260928090000 must sort after 20260928090000'),
    ]);
    expect(check([{ status: 'A', path: path('20260927000000_older.sql') }])).toHaveLength(1);
  });

  it('fails a name the Supabase CLI would not order correctly', () => {
    expect(check([{ status: 'A', path: path('2026093_short.sql') }])).toEqual([
      expect.stringContaining('the name must be <14-digit UTC timestamp>_<snake_case>.sql'),
    ]);
    expect(check([{ status: 'A', path: path('20260929100000_Bad-Name.sql') }])).toHaveLength(1);
  });

  it('fails two new migrations with the same version', () => {
    expect(
      check([
        { status: 'A', path: path('20260929100000_a.sql') },
        { status: 'A', path: path('20260929100000_b.sql') },
      ]),
    ).toEqual([
      expect.stringContaining('is also used by supabase/migrations/20260929100000_a.sql'),
    ]);
  });

  it('fails a destructive statement without a contract line, naming it', () => {
    const file = path('20260929100000_cleanup.sql');
    const problems = check([{ status: 'A', path: file }], {
      [file]: 'alter table public.profiles drop column legacy;',
    });
    expect(problems).toEqual([
      expect.stringContaining('drops a column ("alter table public.profiles drop column legacy")'),
    ]);
  });

  it('accepts a destructive statement in a contract migration with a reason', () => {
    const file = path('20260929100000_cleanup.sql');
    const sql = '-- contract: no deployed code reads profiles.legacy since #12\n';
    expect(
      check([{ status: 'A', path: file }], {
        [file]: `${sql}alter table public.profiles drop column legacy;`,
      }),
    ).toEqual([]);
    expect(
      check([{ status: 'A', path: file }], {
        [file]: '-- contract:\nalter table public.profiles drop column legacy;',
      }),
    ).toHaveLength(1);
  });

  it('ignores files outside supabase/migrations and works without base migrations', () => {
    expect(check([{ status: 'M', path: 'supabase/tests/projects.test.sql' }])).toEqual([]);
    expect(
      checkMigrations({
        baseFiles: [],
        changes: [{ status: 'A', path: path('20260924000000_baseline.sql') }],
        read: () => 'create schema private;',
      }),
    ).toEqual([]);
  });
});
