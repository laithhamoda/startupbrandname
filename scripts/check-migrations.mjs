// Keeps database migrations safe to deploy (D-012, D-141). CI runs it on pull requests:
//   node scripts/check-migrations.mjs origin/main
// It compares the committed migrations with the base branch and fails when
// - a migration that is already merged is edited, renamed or deleted: `supabase db push` applies
//   only versions the database has not recorded, so the change would never reach staging or
//   production;
// - a new migration's version does not sort after the newest one on the base branch, so it would
//   run in a different order on an empty database than on the hosted ones;
// - a new migration drops, renames or retypes something (see DESTRUCTIVE) without a line
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
// collapsed.
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
    name: 'changes a column type',
    regex: /^alter table\b.*\balter (column )?(?!column )\S+ (set data )?type\b/,
  },
  { name: 'drops a type attribute', regex: /^alter type\b.*\bdrop\b/ },
  { name: 'empties a table', regex: /^truncate\b/ },
];

const IDENTIFIER_CHAR = /[\w$]/;

/**
 * The SQL statements of a migration, lowercased, with comments removed, the contents of string
 * literals and dollar-quoted bodies replaced by '', and whitespace collapsed.
 */
export function sqlStatements(sql) {
  const statements = [];
  let code = '';
  const endStatement = () => {
    const statement = code.replace(/\s+/g, ' ').trim().toLowerCase();
    if (statement) statements.push(statement);
    code = '';
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
      i += 1;
      while (i < sql.length) {
        if (backslashes && sql[i] === '\\') i += 2;
        else if (sql[i] === "'" && sql[i + 1] === "'") i += 2;
        else if (sql[i] === "'") break;
        else i += 1;
      }
      i += 1;
      code += "''";
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
        const end = sql.indexOf(tag, i + tag.length);
        i = end === -1 ? sql.length : end + tag.length;
        code += "''";
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

/** What makes each destructive statement in a migration destructive, in file order. */
export function findDestructive(sql) {
  return sqlStatements(sql).flatMap((statement) =>
    DESTRUCTIVE.filter(({ regex }) => regex.test(statement)).map(({ name }) => ({
      name,
      statement: statement.length > 80 ? `${statement.slice(0, 77)}...` : statement,
    })),
  );
}

/**
 * Checks the migration changes of a branch.
 * - baseFiles: the file names in supabase/migrations on the base branch
 * - changes: [{ status, path }] from `git diff --name-status --no-renames base...HEAD`, where a
 *   rename appears as a deletion plus an addition
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

function git(...args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

function main() {
  const base = process.argv[2] ?? 'origin/main';
  try {
    git('rev-parse', '--verify', '--quiet', `${base}^{commit}`);
  } catch {
    console.error(
      `Base "${base}" not found. Fetch it first (in CI: actions/checkout with fetch-depth: 0).`,
    );
    process.exit(2);
  }

  const baseFiles = git('ls-tree', '--name-only', base, '--', MIGRATIONS_DIR)
    .split('\n')
    .filter(Boolean)
    .map((path) => path.slice(MIGRATIONS_DIR.length));
  const changes = git(
    'diff',
    '--name-status',
    '--no-renames',
    `${base}...HEAD`,
    '--',
    MIGRATIONS_DIR,
  )
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [status = '', path = ''] = line.split('\t');
      return { status: status.charAt(0), path };
    });

  const problems = checkMigrations({
    baseFiles,
    changes,
    read: (path) => git('show', `HEAD:${path}`),
  });
  if (problems.length > 0) {
    console.error(`Migration check failed against ${base}:`);
    for (const problem of problems) console.error(`  ${problem}`);
    process.exit(1);
  }
  const added = changes.filter(({ status }) => status === 'A').length;
  console.log(`Migration check passed (${added} new migration(s) against ${base}).`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
