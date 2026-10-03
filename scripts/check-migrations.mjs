// Keeps database migrations safe to deploy (D-012, D-141). CI runs it on pull requests:
//   node scripts/check-migrations.mjs origin/main
// It compares the committed migrations with the base branch and fails when
// - a migration that is already merged is edited, renamed or deleted: `supabase db push` applies
//   only versions the database has not recorded, so the change would never reach staging or
//   production;
// - a new migration's version does not sort after the newest one on the base branch, so it would
//   run in a different order on an empty database than on the hosted ones;
// - a new migration drops, renames, moves or retypes something (see DESTRUCTIVE) without a line
//   `-- contract: <reason>`. The app and the database deploy separately and the deployed app must
//   keep working on both schemas, so removals go in a later contract migration, once no deployed
//   code uses the old shape.
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const MIGRATIONS_DIR = 'supabase/migrations/';
const FILE_NAME = /^(\d{14})_[a-z0-9_]+\.sql$/;
const CONTRACT = /^[ \t]*--[ \t]*contract:[ \t]*\S/im;

// Each statement is matched lowercased, with comments removed, string and dollar-quoted bodies
// emptied (a function body runs when it is called, not when the migration runs) and whitespace
// collapsed. The body of a DO block, or of a routine the migration creates and then calls, runs
// with the migration, so it is checked as well (ANYWHERE). Code the migration runs only
// indirectly, through a trigger or a column default, is not followed.
const DESTRUCTIVE = [
  {
    name: 'drops an object',
    regex:
      /^drop (table|view|materialized view|function|procedure|routine|aggregate|schema|type|domain|sequence|extension)\b/,
  },
  {
    // ALTER TABLE … DROP [COLUMN] x; DROP CONSTRAINT and ALTER COLUMN … DROP DEFAULT/NOT NULL/
    // IDENTITY/EXPRESSION keep the data.
    name: 'drops a column',
    regex: /^alter table\b.*\bdrop (?!constraint\b|default\b|not null\b|identity\b|expression\b)/,
  },
  {
    name: 'renames something',
    regex:
      /^alter (table|view|materialized view|function|procedure|routine|schema|type|domain|sequence)\b.*\brename (?!constraint\b)/,
  },
  {
    // To the deployed code, which names the object with its schema, a move is a rename.
    name: 'moves something to another schema',
    regex:
      /^alter (table|view|materialized view|function|procedure|routine|aggregate|type|domain|sequence|extension)\b.*\bset schema\b/,
  },
  {
    name: 'changes a column type',
    regex: /^alter table\b.*\balter (column )?(?!column )\S+ (set data )?type\b/,
  },
  { name: 'drops a type attribute', regex: /^alter type\b.*\bdrop\b/ },
  { name: 'empties a table', regex: /^truncate\b/ },
];

// The same patterns anywhere in a statement, for code that runs with the migration: PL/pgSQL puts
// a statement after IF … THEN or BEGIN, or passes it to EXECUTE as a string.
const ANYWHERE = DESTRUCTIVE.map(({ name, regex }) => ({
  name,
  regex: new RegExp(regex.source.replace(/^\^/, '\\b')),
}));

const IDENTIFIER_CHAR = /[\w$]/;

/**
 * Splits SQL into statements. Each has its text, lowercased, with comments removed and whitespace
 * collapsed, and the raw contents of its string literals and dollar-quoted bodies (literals). The
 * text replaces those contents by '', or keeps them with keepLiterals (dynamic SQL in a DO block).
 */
function parseSql(sql, keepLiterals = false) {
  const statements = [];
  let code = '';
  let literals = [];
  const endStatement = () => {
    const text = code.replace(/\s+/g, ' ').trim().toLowerCase();
    if (text) statements.push({ text, literals });
    code = '';
    literals = [];
  };
  const literal = (contents) => {
    literals.push(contents);
    code += keepLiterals ? ` ${contents} ` : "''";
  };
  let i = 0;
  while (i < sql.length) {
    const char = sql[i];
    const next = sql[i + 1];
    if (char === ';') {
      endStatement();
      i += 1;
    } else if (char === '-' && next === '-') {
      const end = sql.indexOf('\n', i);
      i = end === -1 ? sql.length : end;
    } else if (char === '/' && next === '*') {
      // Block comments nest in PostgreSQL.
      let depth = 0;
      do {
        if (sql.startsWith('/*', i)) {
          depth += 1;
          i += 2;
        } else if (sql.startsWith('*/', i)) {
          depth -= 1;
          i += 2;
        } else {
          i += 1;
        }
      } while (depth > 0 && i < sql.length);
      code += ' ';
    } else if (char === "'") {
      // E'…' strings take backslash escapes; '' is a quote in every string.
      const backslashes = /[eE]/.test(sql[i - 1] ?? '') && !IDENTIFIER_CHAR.test(sql[i - 2] ?? '');
      const start = i + 1;
      i += 1;
      while (i < sql.length) {
        if (backslashes && sql[i] === '\\') i += 2;
        else if (sql[i] === "'" && sql[i + 1] === "'") i += 2;
        else if (sql[i] === "'") break;
        else i += 1;
      }
      literal(sql.slice(start, i).replaceAll("''", "'"));
      i += 1;
    } else if (char === '"') {
      // A quoted identifier is kept: it names what a statement changes.
      let end = i + 1;
      while (end < sql.length && !(sql[end] === '"' && sql[end + 1] !== '"')) {
        end += sql[end] === '"' ? 2 : 1;
      }
      code += sql.slice(i, end + 1);
      i = end + 1;
    } else if (char === '$' && !IDENTIFIER_CHAR.test(sql[i - 1] ?? '')) {
      const tag = /^\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/.exec(sql.slice(i, i + 65))?.[0];
      if (tag) {
        const found = sql.indexOf(tag, i + tag.length);
        const end = found === -1 ? sql.length : found;
        literal(sql.slice(i + tag.length, end));
        i = end + tag.length;
      } else {
        code += char;
        i += 1;
      }
    } else {
      code += char;
      i += 1;
    }
  }
  endStatement();
  return statements;
}

/**
 * The SQL statements of a migration, lowercased, with comments removed, the contents of string
 * literals and dollar-quoted bodies replaced by '', and whitespace collapsed.
 */
export function sqlStatements(sql) {
  return parseSql(sql).map(({ text }) => text);
}

const shorten = (statement) => (statement.length > 80 ? `${statement.slice(0, 77)}...` : statement);

// CREATE [OR REPLACE] FUNCTION|PROCEDURE [schema.]name(…), capturing the name.
const CREATES_ROUTINE =
  /^create (?:or replace )?(?:function|procedure) (?:(?:[\w$]+|"[^"]*")\.)?([\w$]+|"[^"]*") ?\(/;
// Statements that run while the migration runs, and with them any routine they call. A grant, a
// policy or a trigger names a routine without running it.
const RUNS_NOW = /^(select|call|insert|update|delete|merge|with|values)\b/;

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** What makes each destructive statement in a migration destructive, in file order. */
export function findDestructive(sql) {
  const statements = parseSql(sql);
  // The functions and procedures the migration creates. A body runs with the migration only when
  // the migration calls the routine.
  const routines = statements.flatMap(({ text, literals }) => {
    const name = CREATES_ROUTINE.exec(text)?.[1].replaceAll('"', '');
    if (!name) return [];
    const call = new RegExp(`(^|[^\\w$])"?${escapeRegExp(name)}"? ?\\(`);
    return [{ name, bodies: literals, call }];
  });
  const followed = new Set();
  const found = [];

  // Code that runs with the migration (a DO block, or a routine it calls) is checked with the text
  // of its strings, which EXECUTE runs as SQL.
  const checkCode = (label, bodies) => {
    for (const body of bodies) {
      for (const { text } of parseSql(body, true)) {
        for (const { name, regex } of ANYWHERE) {
          const match = regex.exec(text);
          if (!match) continue;
          found.push({ name, statement: shorten(`${label} … ${text.slice(match.index)}`) });
        }
        followCalls(text);
      }
    }
  };
  const followCalls = (text) => {
    for (const routine of routines) {
      if (!followed.has(routine) && routine.call.test(text)) {
        followed.add(routine);
        checkCode(`${routine.name}()`, routine.bodies);
      }
    }
  };

  for (const { text, literals } of statements) {
    for (const { name, regex } of DESTRUCTIVE) {
      if (regex.test(text)) found.push({ name, statement: shorten(text) });
    }
    if (/^do\b/.test(text)) checkCode('do', literals);
    else if (RUNS_NOW.test(text)) followCalls(text);
  }
  return found;
}

/**
 * Checks the migration changes of a branch.
 * - baseFiles: the file names in supabase/migrations on the base branch
 * - changes: [{ status, path }] from `git diff -z --name-status --no-renames base...HEAD`, where
 *   a rename appears as a deletion plus an addition
 * - read(path): the committed contents of an added file
 * Returns the problems found; an empty list means the migrations are safe to merge.
 */
export function checkMigrations({ baseFiles, changes, read }) {
  const newest = baseFiles
    .map((name) => FILE_NAME.exec(name)?.[1])
    .filter(Boolean)
    .sort()
    .at(-1);
  const problems = [];
  const versions = new Map();

  for (const { status, path } of changes) {
    if (!path.startsWith(MIGRATIONS_DIR)) continue;
    if (status !== 'A') {
      const what = status === 'D' ? 'deleted or renamed' : 'edited';
      problems.push(
        `${path}: ${what} after it was merged. A merged migration never changes; add a new one.`,
      );
      continue;
    }

    const name = path.slice(MIGRATIONS_DIR.length);
    const version = FILE_NAME.exec(name)?.[1];
    if (!version) {
      problems.push(
        `${path}: the name must be <14-digit UTC timestamp>_<snake_case>.sql (pnpm supabase migration new <name>).`,
      );
      continue;
    }
    if (newest && version <= newest) {
      problems.push(
        `${path}: version ${version} must sort after ${newest}, the newest migration on the base branch. Rename it with a current timestamp.`,
      );
    }
    const other = versions.get(version);
    if (other) problems.push(`${path}: version ${version} is also used by ${other}.`);
    versions.set(version, path);

    const sql = read(path);
    if (CONTRACT.test(sql)) continue;
    for (const { name: what, statement } of findDestructive(sql)) {
      problems.push(
        `${path}: ${what} ("${statement}"). Move it to a later contract migration and mark that file with "-- contract: <reason>".`,
      );
    }
  }
  return problems;
}

const ROOT = fileURLToPath(new URL('..', import.meta.url));

function git(cwd, ...args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

/**
 * The input of checkMigrations for HEAD against base, read from the repository at cwd. Git lists
 * paths with -z, so they come out as they are: without it, a name with unusual characters is
 * quoted (core.quotePath) and would slip past every rule.
 */
export function readChanges(base, cwd = ROOT) {
  const baseFiles = git(cwd, 'ls-tree', '-z', '--name-only', base, '--', MIGRATIONS_DIR)
    .split('\0')
    .filter(Boolean)
    .map((path) => path.slice(MIGRATIONS_DIR.length));
  // With -z and --no-renames, each change is a status field and a path field, both NUL-ended.
  const fields = git(
    cwd,
    'diff',
    '-z',
    '--name-status',
    '--no-renames',
    `${base}...HEAD`,
    '--',
    MIGRATIONS_DIR,
  ).split('\0');
  const changes = [];
  for (let i = 0; i + 1 < fields.length; i += 2) {
    changes.push({ status: fields[i].charAt(0), path: fields[i + 1] });
  }
  return { baseFiles, changes, read: (path) => git(cwd, 'show', `HEAD:${path}`) };
}

function main() {
  const base = process.argv[2] ?? 'origin/main';
  try {
    git(ROOT, 'rev-parse', '--verify', '--quiet', `${base}^{commit}`);
  } catch {
    console.error(
      `Base "${base}" not found. Fetch it first (in CI: actions/checkout with fetch-depth: 0).`,
    );
    process.exit(2);
  }

  const { baseFiles, changes, read } = readChanges(base);
  const problems = checkMigrations({ baseFiles, changes, read });
  if (problems.length > 0) {
    console.error(`Migration check failed against ${base}:`);
    for (const problem of problems) console.error(`  ${problem}`);
    process.exit(1);
  }
  const added = changes.filter(({ status }) => status === 'A').length;
  console.log(`Migration check passed (${added} new migration(s) against ${base}).`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
