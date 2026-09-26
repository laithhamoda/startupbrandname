// Regenerates apps/web/src/lib/supabase/database.types.ts from the local database.
// Needs the local stack (`pnpm db:start`). CI runs it and fails if the committed file differs.
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { format, resolveConfig } from 'prettier';

const target = 'apps/web/src/lib/supabase/database.types.ts';
const header = [
  '// Types for the public schema. Regenerate with `pnpm db:types` after every migration (needs the',
  '// local Supabase stack); CI fails when this file is out of date.',
  '',
  '',
].join('\n');

const generated = execFileSync(
  'supabase',
  ['gen', 'types', 'typescript', '--local', '--schema', 'public'],
  { encoding: 'utf8' },
);
const options = await resolveConfig(target);
writeFileSync(target, await format(header + generated, { ...options, filepath: target }));
console.log(`Wrote ${target}`);
